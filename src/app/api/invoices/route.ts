// AUTO-GENERATED CRUD route for invoices (PostgreSQL-aware)
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
    if (search && ["number"].length > 0) {
      where.OR = ["number"].map((f: string) => ({ [f]: { contains: search, mode: 'insensitive' } }));
    }

    const [items, total] = await Promise.all([
      (db as any).invoice.findMany({
        where,
        select: { id: true, number: true, customerId: true, orderId: true, amount: true, taxAmount: true, totalAmount: true, currency: true, status: true, dueDate: true, paidAt: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: Math.min(limit, 200),
        skip: offset,
      }),
      (db as any).invoice.count({ where }),
    ]);

    return { items, total, limit, offset };
  });
}

export async function POST(req: NextRequest) {
  return withTenant(req, async (ctx: AuthContext) => {
    const d = await req.json().catch(() => ({}));
    const created = await (db as any).invoice.create({ data: { tenantId: ctx.tenantId!, number: d.number || ('INV-' + Date.now()), customerId: d.customerId, orderId: d.orderId || null, amount: d.amount, taxAmount: d.taxAmount || 0, totalAmount: d.totalAmount || d.amount, currency: d.currency || 'INR', status: d.status || 'unpaid', dueDate: d.dueDate ? new Date(d.dueDate) : null } });
    await quickAudit(ctx, 'create', 'invoice', created.id, JSON.stringify(d).slice(0, 500));

    // Fire workflow trigger
    if (created.id) {
      try {
        await runWorkflow({
          tenantId: ctx.tenantId!,
          trigger: "payment_overdue",
          entityRef: { entity: 'invoice', id: created.id },
          triggerData: { status: created.status, stage: created.stage },
          userId: ctx.session.sub,
        });
      } catch (e) {
        console.error('[workflow] trigger failed', e);
      }
    }

    return created;
  });
}

export async function PATCH(req: NextRequest) {
  return withTenant(req, async (ctx: AuthContext) => {
    const d = await req.json().catch(() => ({}));
    const id = qp(req, 'id') || d.id;
    if (!id) return NextResponse.json({ error: 'id_required' }, { status: 400 });

    const existing = await (db as any).invoice.findFirst({ where: { id, tenantId: ctx.tenantId } });
    if (!existing) return NextResponse.json({ error: 'not_found' }, { status: 404 });

    // Build update data — only include fields that are actually provided
    const updateData: any = {};
    const provided = Object.fromEntries(Object.entries(d).filter(([k, v]) => v !== undefined));
    // Apply our update mapping (functions handle Date conversion)
    const updateTemplate: any = { amount: d.amount, taxAmount: d.taxAmount, totalAmount: d.totalAmount, status: d.status, dueDate: d.dueDate ? new Date(d.dueDate) : null, paidAt: d.status === 'paid' ? new Date() : null };
    for (const key of Object.keys(provided)) {
      if (key in updateTemplate && updateTemplate[key] !== undefined) {
        updateData[key] = updateTemplate[key];
      }
    }

    const updated = await (db as any).invoice.update({ where: { id }, data: updateData });
    await quickAudit(ctx, 'update', 'invoice', id, JSON.stringify(d).slice(0, 500));
    return updated;
  });
}

export async function DELETE(req: NextRequest) {
  return withTenant(req, async (ctx: AuthContext) => {
    const id = qp(req, 'id');
    if (!id) return NextResponse.json({ error: 'id_required' }, { status: 400 });
    const existing = await (db as any).invoice.findFirst({ where: { id, tenantId: ctx.tenantId } });
    if (!existing) return NextResponse.json({ error: 'not_found' }, { status: 404 });
    await (db as any).invoice.delete({ where: { id } });
    await quickAudit(ctx, 'delete', 'invoice', id);
    return { ok: true };
  });
}
