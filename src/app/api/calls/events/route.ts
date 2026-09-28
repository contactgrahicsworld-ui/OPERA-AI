// SIM-based calling — call event ingestion from Android devices
// Implements idempotency via eventId + state machine validation
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { withTenant, qp, quickAudit, type AuthContext } from '@/lib/api-helpers';
import { randomUUID } from 'crypto';

const VALID_EVENTS = ['QUEUED', 'SENT', 'RECEIVED', 'DIALING', 'RINGING', 'CONNECTED', 'ENDED', 'FAILED', 'CANCELLED'];
const STATE_TRANSITIONS: Record<string, string[]> = {
  QUEUED: ['SENT', 'CANCELLED', 'FAILED'],
  SENT: ['RECEIVED', 'FAILED'],
  RECEIVED: ['DIALING', 'FAILED', 'CANCELLED'],
  DIALING: ['RINGING', 'FAILED', 'CANCELLED'],
  RINGING: ['CONNECTED', 'FAILED', 'CANCELLED'],
  CONNECTED: ['ENDED'],
  ENDED: [],
  FAILED: [],
  CANCELLED: [],
};

export const dynamic = 'force-dynamic';

// POST: ingest a call event from a paired Android device
export async function POST(req: NextRequest) {
  return withTenant(req, async (ctx: AuthContext) => {
    const body = await req.json().catch(() => ({}));
    const { callRequestId, eventType, payload, deviceId, eventId } = body;

    if (!callRequestId || !eventType || !eventId) {
      return NextResponse.json({ error: 'missing_fields' }, { status: 400 });
    }
    if (!VALID_EVENTS.includes(eventType)) {
      return NextResponse.json({ error: 'invalid_event_type' }, { status: 400 });
    }

    // Idempotency: if eventId already exists, return success without re-processing
    const existingEvent = await db.callEvent.findUnique({ where: { eventId } });
    if (existingEvent) {
      return NextResponse.json({ ok: true, duplicate: true, eventId });
    }

    // Find the call request — defense-in-depth: must belong to this tenant
    const cr = await db.callRequest.findFirst({
      where: { id: callRequestId, tenantId: ctx.tenantId },
    });
    if (!cr) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }

    // Validate state transition
    const allowed = STATE_TRANSITIONS[cr.state] || [];
    if (allowed.length > 0 && !allowed.includes(eventType)) {
      return NextResponse.json({ error: 'invalid_transition', from: cr.state, to: eventType }, { status: 400 });
    }

    // Create the event
    await db.callEvent.create({
      data: {
        tenantId: ctx.tenantId!,
        callRequestId,
        eventId,
        eventType,
        payload: payload || {},
      },
    });

    // Update call request state + timestamps
    const now = new Date();
    const updates: any = { state: eventType };
    if (eventType === 'SENT') updates.sentAt = now;
    if (eventType === 'RECEIVED') updates.receivedAt = now;
    if (eventType === 'CONNECTED') updates.startedAt = now;
    if (eventType === 'ENDED') {
      updates.endedAt = now;
      if (payload?.duration) updates.duration = Number(payload.duration);
      if (payload?.outcome) updates.outcome = String(payload.outcome);
    }
    if (eventType === 'FAILED') updates.failureReason = String(payload?.reason || '');

    const updated = await db.callRequest.update({
      where: { id: callRequestId },
      data: updates,
    });

    // When call ENDED, create a CRM Call record (the heart of the integration)
    if (eventType === 'ENDED' && !cr.call) {
      const call = await db.call.create({
        data: {
          tenantId: ctx.tenantId!,
          leadId: cr.leadId,
          customerId: cr.customerId,
          contactId: cr.contactId,
          callerId: cr.callerId,
          callRequestId: cr.id,
          direction: 'outbound',
          status: 'connected',
          duration: Number(payload?.duration || 0),
          outcome: String(payload?.outcome || ''),
          notes: String(payload?.notes || cr.notes || ''),
          telecaller: 'human',
        },
      }).catch(() => null);
      if (call) {
        await db.callRequest.update({ where: { id: cr.id }, data: {} });
      }
    }

    await quickAudit(ctx, 'call_event', 'callEvent', eventId, `type=${eventType} cr=${callRequestId}`);
    return NextResponse.json({ ok: true, state: eventType });
  });
}

// GET: list events for a call request (for debugging / dashboard)
export async function GET(req: NextRequest) {
  return withTenant(req, async (ctx: AuthContext) => {
    const callRequestId = qp(req, 'callRequestId');
    if (!callRequestId) return NextResponse.json({ error: 'callRequestId_required' }, { status: 400 });
    const items = await db.callEvent.findMany({
      where: { tenantId: ctx.tenantId, callRequestId },
      orderBy: { receivedAt: 'asc' },
    });
    return { items };
  });
}
