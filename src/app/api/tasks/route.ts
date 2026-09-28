// AUTO-GENERATED CRUD route for tasks
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
      (db as any).task.findMany({
        where,
        select: { id: true, title: true, description: true, type: true, status: true, priority: true, dueDate: true, leadId: true, customerId: true, assigneeId: true, ownerId: true, completedAt: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: Math.min(limit, 200),
        skip: offset,
      }),
      (db as any).task.count({ where }),
    ]);

    return { items, total, limit, offset };
  });
}

export async function POST(req: NextRequest) {
  return withTenant(req, async (ctx: AuthContext) => {
    const d = await req.json().catch(() => ({}));
    const created = await (db as any).task.create({ data: { tenantId, title: d.title, description: d.description || '', type: d.type || 'general', status: d.status || 'open', priority: d.priority || 'medium', dueDate: d.dueDate ? new Date(d.dueDate) : null, leadId: d.leadId || null, customerId: d.customerId || null, assigneeId: d.assigneeId || null, ownerId: ctx.session.sub } });
    await quickAudit(ctx, 'create', 'task', created.id, JSON.stringify(d).slice(0, 500));

    // Fire workflow triggers
    if ('task' === 'lead') {
      await runWorkflow({ tenantId: ctx.tenantId, trigger: 'new_lead', entityRef: { entity: 'lead', id: created.id }, triggerData: { stage: created.stage, status: created.status }, userId: ctx.session.sub });
    }
    if ('task' === 'quotation' && created.status === 'sent') {
      await runWorkflow({ tenantId: ctx.tenantId, trigger: 'quotation_inactive', entityRef: { entity: 'quotation', id: created.id }, triggerData: { status: 'sent', lastActivityAt: created.sentAt || new Date().toISOString() }, userId: ctx.session.sub });
    }
    if ('task' === 'invoice' && created.dueDate && new Date(created.dueDate) < new Date()) {
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

    const existing = await (db as any).task.findFirst({ where: { id, tenantId: ctx.tenantId } });
    if (!existing) return NextResponse.json({ error: 'not_found' }, { status: 404 });

    const updated = await (db as any).task.update({ where: { id }, data: { title: d.title, description: d.description, type: d.type, status: d.status, priority: d.priority, dueDate: d.dueDate ? new Date(d.dueDate) : null, assigneeId: d.assigneeId, completedAt: d.status === 'done' ? new Date() : null } });
    await quickAudit(ctx, 'update', 'task', id, JSON.stringify(d).slice(0, 500));
    return updated;
  });
}

export async function DELETE(req: NextRequest) {
  return withTenant(req, async (ctx: AuthContext) => {
    const id = qp(req, 'id');
    if (!id) return NextResponse.json({ error: 'id_required' }, { status: 400 });
    const existing = await (db as any).task.findFirst({ where: { id, tenantId: ctx.tenantId } });
    if (!existing) return NextResponse.json({ error: 'not_found' }, { status: 404 });
    await (db as any).task.delete({ where: { id } });
    await quickAudit(ctx, 'delete', 'task', id);
    return { ok: true };
  });
}
