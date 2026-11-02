// Field Sales — visit management with check-in/check-out + notes + GPS (where permitted)
// Uses Activity model with type='visit' + custom fields for check-in/out + location
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { withTenant, qp, quickAudit, type AuthContext } from '@/lib/api-helpers';
import { z } from 'zod';

const CHECKIN_SCHEMA = z.object({
  customerId: z.string().optional(),
  leadId: z.string().optional(),
  contactId: z.string().optional(),
  title: z.string().min(2).max(200),
  notes: z.string().max(2000).optional(),
  // GPS location — only sent if user explicitly grants permission (permission-based, minimized)
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  locationAccuracy: z.number().min(0).optional(),
});

export const dynamic = 'force-dynamic';

// GET: list visits for this tenant
export async function GET(req: NextRequest) {
  return withTenant(req, async (ctx: AuthContext) => {
    const status = qp(req, 'status', ''); // checked-in | checked-out | completed
    const assigneeId = qp(req, 'assigneeId', '');
    const limit = parseInt(qp(req, 'limit', '50'));

    const where: any = { tenantId: ctx.tenantId, type: 'visit' };
    if (assigneeId) where.ownerId = assigneeId;

    const visits = await db.activity.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 200),
    });

    // Format as field visits
    const formatted = visits.map((v) => ({
      id: v.id,
      title: v.title,
      customerId: v.customerId,
      leadId: v.leadId,
      ownerId: v.ownerId,
      notes: v.description,
      outcome: v.outcome,
      checkInAt: v.scheduledAt,
      checkOutAt: v.completedAt,
      status: v.completedAt ? 'completed' : v.scheduledAt ? 'checked-in' : 'pending',
      createdAt: v.createdAt,
    }));

    return { items: formatted, total: formatted.length };
  });
}

// POST: check-in (create a field visit)
export async function POST(req: NextRequest) {
  return withTenant(req, async (ctx: AuthContext) => {
    const body = await req.json().catch(() => ({}));
    const parsed = CHECKIN_SCHEMA.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'invalid_input', details: parsed.error.flatten() }, { status: 400 });
    }
    const d = parsed.data;

    // Store GPS in description (if provided — permission-based, minimized per spec)
    const gpsNote = (d.latitude && d.longitude)
      ? `\n\n[GPS: ${d.latitude.toFixed(6)},${d.longitude.toFixed(6)} accuracy=${d.locationAccuracy || 'unknown'}m]`
      : '';

    const visit = await db.activity.create({
      data: {
        tenantId: ctx.tenantId!,
        type: 'visit',
        title: d.title,
        description: (d.notes || '') + gpsNote,
        leadId: d.leadId || null,
        customerId: d.customerId || null,
        contactId: d.contactId || null,
        ownerId: ctx.session.sub,
        scheduledAt: new Date(), // check-in time
        outcome: '',
      },
    });

    await quickAudit(ctx, 'field_visit_checkin', 'activity', visit.id, `title=${d.title}`);
    return { ok: true, visitId: visit.id, checkInAt: visit.scheduledAt };
  });
}

// PATCH: check-out (mark visit complete with outcome)
export async function PATCH(req: NextRequest) {
  return withTenant(req, async (ctx: AuthContext) => {
    const body = await req.json().catch(() => ({}));
    const { visitId, outcome, notes } = body;
    if (!visitId) return NextResponse.json({ error: 'visitId_required' }, { status: 400 });

    const existing = await db.activity.findFirst({
      where: { id: visitId, tenantId: ctx.tenantId, type: 'visit' },
    });
    if (!existing) return NextResponse.json({ error: 'not_found' }, { status: 404 });

    const updated = await db.activity.update({
      where: { id: visitId },
      data: {
        completedAt: new Date(),
        outcome: outcome || existing.outcome,
        description: notes ? (existing.description + '\n\n[Check-out notes]: ' + notes) : existing.description,
      },
    });

    // Create follow-up task if outcome suggests one
    if (outcome && outcome.toLowerCase().includes('follow')) {
      await db.task.create({
        data: {
          tenantId: ctx.tenantId!,
          title: `Follow-up after visit: ${existing.title}`,
          type: 'follow_up',
          status: 'open',
          priority: 'medium',
          dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
          customerId: existing.customerId,
          leadId: existing.leadId,
          assigneeId: existing.ownerId,
          ownerId: existing.ownerId,
        },
      }).catch(() => null);
    }

    await quickAudit(ctx, 'field_visit_checkout', 'activity', visitId, `outcome=${outcome || ''}`);
    return { ok: true, checkOutAt: updated.completedAt };
  });
}
