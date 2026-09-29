// AUTO-GENERATED CRUD route for deals (PostgreSQL-aware)
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
    if (search && ["title"].length > 0) {
      where.OR = ["title"].map((f: string) => ({ [f]: { contains: search, mode: 'insensitive' } }));
    }

    const [items, total] = await Promise.all([
      (db as any).deal.findMany({
        where,
        select: { id: true, title: true, customerId: true, contactId: true, value: true, stage: true, ownerId: true, expectedCloseDate: true, probability: true, closedAt: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: Math.min(limit, 200),
        skip: offset,
      }),
      (db as any).deal.count({ where }),
    ]);

    return { items, total, limit, offset };
  });
}

export async function POST(req: NextRequest) {
  return withTenant(req, async (ctx: AuthContext) => {
    const d = await req.json().catch(() => ({}));
    const created = await (db as any).deal.create({ data: { tenantId: ctx.tenantId!, title: d.title, customerId: d.customerId || null, contactId: d.contactId || null, value: d.value || 0, stage: d.stage || 'New', pipelineId: d.pipelineId || null, ownerId: d.ownerId || null, expectedCloseDate: d.expectedCloseDate ? new Date(d.expectedCloseDate) : null, probability: d.probability || 0 } });
    await quickAudit(ctx, 'create', 'deal', created.id, JSON.stringify(d).slice(0, 500));

    // No workflow trigger for this entity

    return created;
  });
}

export async function PATCH(req: NextRequest) {
  return withTenant(req, async (ctx: AuthContext) => {
    const d = await req.json().catch(() => ({}));
    const id = qp(req, 'id') || d.id;
    if (!id) return NextResponse.json({ error: 'id_required' }, { status: 400 });

    const existing = await (db as any).deal.findFirst({ where: { id, tenantId: ctx.tenantId } });
    if (!existing) return NextResponse.json({ error: 'not_found' }, { status: 404 });

    // Build update data — only include fields that are actually provided
    const updateData: any = {};
    const provided = Object.fromEntries(Object.entries(d).filter(([k, v]) => v !== undefined));
    // Apply our update mapping (functions handle Date conversion)
    const updateTemplate: any = { title: d.title, customerId: d.customerId, contactId: d.contactId, value: d.value, stage: d.stage, ownerId: d.ownerId, expectedCloseDate: d.expectedCloseDate ? new Date(d.expectedCloseDate) : null, probability: d.probability, closedAt: d.closedAt ? new Date(d.closedAt) : null };
    for (const key of Object.keys(provided)) {
      if (key in updateTemplate && updateTemplate[key] !== undefined) {
        updateData[key] = updateTemplate[key];
      }
    }

    const updated = await (db as any).deal.update({ where: { id }, data: updateData });
    await quickAudit(ctx, 'update', 'deal', id, JSON.stringify(d).slice(0, 500));
    return updated;
  });
}

export async function DELETE(req: NextRequest) {
  return withTenant(req, async (ctx: AuthContext) => {
    const id = qp(req, 'id');
    if (!id) return NextResponse.json({ error: 'id_required' }, { status: 400 });
    const existing = await (db as any).deal.findFirst({ where: { id, tenantId: ctx.tenantId } });
    if (!existing) return NextResponse.json({ error: 'not_found' }, { status: 404 });
    await (db as any).deal.delete({ where: { id } });
    await quickAudit(ctx, 'delete', 'deal', id);
    return { ok: true };
  });
}
