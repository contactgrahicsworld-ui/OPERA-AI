// AUTO-GENERATED CRUD route for quotations
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
      (db as any).quotation.findMany({
        where,
        select: { id: true, number: true, leadId: true, customerId: true, subject: true, status: true, totalAmount: true, discount: true, taxAmount: true, currency: true, validTill: true, sentAt: true, approvedAt: true, ownerId: true, items: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: Math.min(limit, 200),
        skip: offset,
      }),
      (db as any).quotation.count({ where }),
    ]);

    return { items, total, limit, offset };
  });
}

export async function POST(req: NextRequest) {
  return withTenant(req, async (ctx: AuthContext) => {
    const d = await req.json().catch(() => ({}));
    const created = await (db as any).quotation.create({ data: { tenantId, number: d.number || ('Q-' + Date.now()), leadId: d.leadId || null, customerId: d.customerId || null, subject: d.subject, status: d.status || 'draft', totalAmount: d.totalAmount || 0, discount: d.discount || 0, taxAmount: d.taxAmount || 0, currency: d.currency || 'INR', validTill: d.validTill ? new Date(d.validTill) : null, ownerId: ctx.session.sub, items: JSON.stringify(d.items || []) } });
    await quickAudit(ctx, 'create', 'quotation', created.id, JSON.stringify(d).slice(0, 500));

    // Fire workflow triggers
    if ('quotation' === 'lead') {
      await runWorkflow({ tenantId: ctx.tenantId, trigger: 'new_lead', entityRef: { entity: 'lead', id: created.id }, triggerData: { stage: created.stage, status: created.status }, userId: ctx.session.sub });
    }
    if ('quotation' === 'quotation' && created.status === 'sent') {
      await runWorkflow({ tenantId: ctx.tenantId, trigger: 'quotation_inactive', entityRef: { entity: 'quotation', id: created.id }, triggerData: { status: 'sent', lastActivityAt: created.sentAt || new Date().toISOString() }, userId: ctx.session.sub });
    }
    if ('quotation' === 'invoice' && created.dueDate && new Date(created.dueDate) < new Date()) {
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

    const existing = await (db as any).quotation.findFirst({ where: { id, tenantId: ctx.tenantId } });
    if (!existing) return NextResponse.json({ error: 'not_found' }, { status: 404 });

    const updated = await (db as any).quotation.update({ where: { id }, data: { subject: d.subject, status: d.status, totalAmount: d.totalAmount, discount: d.discount, taxAmount: d.taxAmount, validTill: d.validTill ? new Date(d.validTill) : null, sentAt: d.status === 'sent' ? new Date() : undefined, approvedAt: d.status === 'approved' ? new Date() : undefined, items: JSON.stringify(d.items || []) } });
    await quickAudit(ctx, 'update', 'quotation', id, JSON.stringify(d).slice(0, 500));
    return updated;
  });
}

export async function DELETE(req: NextRequest) {
  return withTenant(req, async (ctx: AuthContext) => {
    const id = qp(req, 'id');
    if (!id) return NextResponse.json({ error: 'id_required' }, { status: 400 });
    const existing = await (db as any).quotation.findFirst({ where: { id, tenantId: ctx.tenantId } });
    if (!existing) return NextResponse.json({ error: 'not_found' }, { status: 404 });
    await (db as any).quotation.delete({ where: { id } });
    await quickAudit(ctx, 'delete', 'quotation', id);
    return { ok: true };
  });
}
