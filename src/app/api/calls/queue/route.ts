// SIM-based calling — call request queue
// Web app → secure backend → paired Android device → SIM/eSIM → real cellular call
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { withTenant, qp, quickAudit, type AuthContext } from '@/lib/api-helpers';
import { z } from 'zod';
import { randomUUID } from 'crypto';

const QUEUE_SCHEMA = z.object({
  leadId: z.string().optional(),
  customerId: z.string().optional(),
  contactId: z.string().optional(),
  phoneNumber: z.string().min(4).max(20),
  priority: z.number().int().min(1).max(10).default(5),
  notes: z.string().max(2000).default(''),
});

export const dynamic = 'force-dynamic';

// GET: list queued calls for this tenant's devices
export async function GET(req: NextRequest) {
  return withTenant(req, async (ctx: AuthContext) => {
    const state = qp(req, 'state', 'QUEUED,SENT,RECEIVED,DIALING,RINGING,CONNECTED');
    const deviceId = qp(req, 'deviceId', '');
    const items = await db.callRequest.findMany({
      where: {
        tenantId: ctx.tenantId,
        state: { in: state.split(',').map((s) => s.trim()).filter(Boolean) },
        ...(deviceId ? { deviceId } : {}),
      },
      orderBy: [{ priority: 'desc' }, { queuedAt: 'asc' }],
      take: 100,
    });
    return { items };
  });
}

// POST: queue a new call request (idempotent via idempotencyKey)
export async function POST(req: NextRequest) {
  return withTenant(req, async (ctx: AuthContext) => {
    const body = await req.json().catch(() => ({}));
    const parsed = QUEUE_SCHEMA.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'invalid_input', details: parsed.error.flatten() }, { status: 400 });
    }
    const d = parsed.data;
    const idempotencyKey = (req.headers.get('x-idempotency-key') as string) || randomUUID();
    const eventId = randomUUID();

    // Idempotency: if a request with this key already exists, return it without creating a new one
    const existing = await db.callRequest.findUnique({ where: { idempotencyKey } });
    if (existing) {
      return NextResponse.json({ ok: true, id: existing.id, state: existing.state, duplicate: true });
    }

    // Validate phone number (very simple — production would use libphonenumber)
    const phone = d.phoneNumber.replace(/[^0-9+]/g, '');
    if (phone.length < 4 || phone.length > 20) {
      return NextResponse.json({ error: 'invalid_phone' }, { status: 400 });
    }

    const cr = await db.callRequest.create({
      data: {
        tenantId: ctx.tenantId!,
        leadId: d.leadId || null,
        customerId: d.customerId || null,
        contactId: d.contactId || null,
        callerId: ctx.session.sub,
        phoneNumber: phone,
        state: 'QUEUED',
        idempotencyKey,
        eventId,
        priority: d.priority,
        notes: d.notes,
      },
    });

    // Create initial event
    await db.callEvent.create({
      data: {
        tenantId: ctx.tenantId!,
        callRequestId: cr.id,
        eventId: randomUUID(),
        eventType: 'QUEUED',
        payload: { queuedAt: new Date().toISOString() },
      },
    });

    await quickAudit(ctx, 'call_queue', 'callRequest', cr.id, `phone=${phone}`);
    return NextResponse.json({ ok: true, id: cr.id, state: 'QUEUED' });
  });
}
