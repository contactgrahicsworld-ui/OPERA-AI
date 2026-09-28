// AUTO-GENERATED CRUD route for leads
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
      (db as any).lead.findMany({
        where,
        select: { id: true, name: true, email: true, phone: true, company: true, status: true, stage: true, ownerId: true, value: true, priority: true, tagsCsv: true, notes: true, lastActivityAt: true, convertedAt: true, createdAt: true, updatedAt: true },
        orderBy: { createdAt: 'desc' },
        take: Math.min(limit, 200),
        skip: offset,
      }),
      (db as any).lead.count({ where }),
    ]);

    return { items, total, limit, offset };
  });
}

export async function POST(req: NextRequest) {
  return withTenant(req, async (ctx: AuthContext) => {
    const d = await req.json().catch(() => ({}));
    const created = await (db as any).lead.create({ data: { tenantId, name: d.name, email: d.email || '', phone: d.phone || '', company: d.company || '', source: d.source || 'manual', status: d.status || 'New', stage: d.stage || 'New', ownerId: d.ownerId || null, value: d.value || 0, priority: d.priority || 'medium', tagsCsv: (d.tags || []).join(','), notes: d.notes || '' } });
    await quickAudit(ctx, 'create', 'lead', created.id, JSON.stringify(d).slice(0, 500));

    // Fire workflow triggers
    if ('lead' === 'lead') {
      await runWorkflow({ tenantId: ctx.tenantId, trigger: 'new_lead', entityRef: { entity: 'lead', id: created.id }, triggerData: { stage: created.stage, status: created.status }, userId: ctx.session.sub });
    }
    if ('lead' === 'quotation' && created.status === 'sent') {
      await runWorkflow({ tenantId: ctx.tenantId, trigger: 'quotation_inactive', entityRef: { entity: 'quotation', id: created.id }, triggerData: { status: 'sent', lastActivityAt: created.sentAt || new Date().toISOString() }, userId: ctx.session.sub });
    }
    if ('lead' === 'invoice' && created.dueDate && new Date(created.dueDate) < new Date()) {
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

    const existing = await (db as any).lead.findFirst({ where: { id, tenantId: ctx.tenantId } });
    if (!existing) return NextResponse.json({ error: 'not_found' }, { status: 404 });

    const updated = await (db as any).lead.update({ where: { id }, data: { name: d.name, email: d.email, phone: d.phone, company: d.company, source: d.source, status: d.status, stage: d.stage, ownerId: d.ownerId, value: d.value, priority: d.priority, tagsCsv: (d.tags || []).join(','), notes: d.notes, lastActivityAt: d.lastActivityAt } });
    await quickAudit(ctx, 'update', 'lead', id, JSON.stringify(d).slice(0, 500));
    return updated;
  });
}

export async function DELETE(req: NextRequest) {
  return withTenant(req, async (ctx: AuthContext) => {
    const id = qp(req, 'id');
    if (!id) return NextResponse.json({ error: 'id_required' }, { status: 400 });
    const existing = await (db as any).lead.findFirst({ where: { id, tenantId: ctx.tenantId } });
    if (!existing) return NextResponse.json({ error: 'not_found' }, { status: 404 });
    await (db as any).lead.delete({ where: { id } });
    await quickAudit(ctx, 'delete', 'lead', id);
    return { ok: true };
  });
}
