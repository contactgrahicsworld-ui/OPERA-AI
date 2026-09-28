// AUTO-GENERATED CRUD route for calls
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { withTenant, qp, quickAudit, type AuthContext } from '@/lib/api-helpers';
import { runWorkflow } from '@/lib/workflow';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  return withTenant(req, async (ctx: AuthContext) => {
    const search = qp(req, 'search');
    const status = qp(req, 'status');
    const limit = parseInt(qp(req, 'limit', '50'));
    const offset = parseInt(qp(req, 'offset', '0'));

    const where: any = { tenantId: ctx.tenantId };
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { email: { contains: search } },
        { phone: { contains: search } },
        { title: { contains: search } },
        { subject: { contains: search } },
        { description: { contains: search } },
        { number: { contains: search } },
      ];
    }

    const [items, total] = await Promise.all([
      (db as any).call.findMany({
        where,
        select: { id: true, leadId: true, customerId: true, contactId: true, callerId: true, direction: true, status: true, outcome: true, duration: true, notes: true, nextFollowUpAt: true, telecaller: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: Math.min(limit, 200),
        skip: offset,
      }),
      (db as any).call.count({ where }),
    ]);

    return { items, total, limit, offset };
  });
}

export async function POST(req: NextRequest) {
  return withTenant(req, async (ctx: AuthContext) => {
    const d = await req.json().catch(() => ({}));
    const created = await (db as any).call.create({ data: { tenantId, leadId: d.leadId || null, customerId: d.customerId || null, contactId: d.contactId || null, callerId: ctx.session.sub, direction: d.direction || 'outbound', status: d.status || 'planned', outcome: d.outcome || '', duration: d.duration || 0, notes: d.notes || '', nextFollowUpAt: d.nextFollowUpAt ? new Date(d.nextFollowUpAt) : null, telecaller: 'human' } });
    await quickAudit(ctx, 'create', 'call', created.id, JSON.stringify(d).slice(0, 500));

    // Fire workflow triggers
    if ('call' === 'lead') {
      await runWorkflow({ tenantId: ctx.tenantId, trigger: 'new_lead', entityRef: { entity: 'lead', id: created.id }, triggerData: { stage: created.stage, status: created.status }, userId: ctx.session.sub });
    }
    if ('call' === 'quotation' && created.status === 'sent') {
      await runWorkflow({ tenantId: ctx.tenantId, trigger: 'quotation_inactive', entityRef: { entity: 'quotation', id: created.id }, triggerData: { status: 'sent', lastActivityAt: created.sentAt || new Date().toISOString() }, userId: ctx.session.sub });
    }
    if ('call' === 'invoice' && created.dueDate && new Date(created.dueDate) < new Date()) {
      await runWorkflow({ tenantId: ctx.tenantId, trigger: 'payment_overdue', entityRef: { entity: 'invoice', id: created.id }, triggerData: { status: 'overdue' }, userId: ctx.session.sub });
    }

    return created;
  });
}

export async function PATCH(req: NextRequest) {
  return withTenant(req, async (ctx: AuthContext) => {
    const d = await req.json().catch(() => ({}));
    const id = qp(req, 'id') || d.id;
    if (!id) return NextResponse.json({ error: 'id_required' }, { status: 400 });

    const existing = await (db as any).call.findFirst({ where: { id, tenantId: ctx.tenantId } });
    if (!existing) return NextResponse.json({ error: 'not_found' }, { status: 404 });

    const updated = await (db as any).call.update({ where: { id }, data: { direction: d.direction, status: d.status, outcome: d.outcome, duration: d.duration, notes: d.notes, nextFollowUpAt: d.nextFollowUpAt ? new Date(d.nextFollowUpAt) : null } });
    await quickAudit(ctx, 'update', 'call', id, JSON.stringify(d).slice(0, 500));
    return updated;
  });
}

export async function DELETE(req: NextRequest) {
  return withTenant(req, async (ctx: AuthContext) => {
    const id = qp(req, 'id');
    if (!id) return NextResponse.json({ error: 'id_required' }, { status: 400 });
    const existing = await (db as any).call.findFirst({ where: { id, tenantId: ctx.tenantId } });
    if (!existing) return NextResponse.json({ error: 'not_found' }, { status: 404 });
    await (db as any).call.delete({ where: { id } });
    await quickAudit(ctx, 'delete', 'call', id);
    return { ok: true };
  });
}
