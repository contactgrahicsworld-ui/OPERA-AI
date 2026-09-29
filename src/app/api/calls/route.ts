// AUTO-GENERATED CRUD route for calls (PostgreSQL-aware)
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
    if (search && ["outcome","notes"].length > 0) {
      where.OR = ["outcome","notes"].map((f: string) => ({ [f]: { contains: search, mode: 'insensitive' } }));
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
    const created = await (db as any).call.create({ data: { tenantId: ctx.tenantId!, leadId: d.leadId || null, customerId: d.customerId || null, contactId: d.contactId || null, callerId: ctx.session.sub, direction: d.direction || 'outbound', status: d.status || 'planned', outcome: d.outcome || '', duration: d.duration || 0, notes: d.notes || '', nextFollowUpAt: d.nextFollowUpAt ? new Date(d.nextFollowUpAt) : null, telecaller: 'human' } });
    await quickAudit(ctx, 'create', 'call', created.id, JSON.stringify(d).slice(0, 500));

    // No workflow trigger for this entity

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

    // Build update data — only include fields that are actually provided
    const updateData: any = {};
    const provided = Object.fromEntries(Object.entries(d).filter(([k, v]) => v !== undefined));
    // Apply our update mapping (functions handle Date conversion)
    const updateTemplate: any = { direction: d.direction, status: d.status, outcome: d.outcome, duration: d.duration, notes: d.notes, nextFollowUpAt: d.nextFollowUpAt ? new Date(d.nextFollowUpAt) : null };
    for (const key of Object.keys(provided)) {
      if (key in updateTemplate && updateTemplate[key] !== undefined) {
        updateData[key] = updateTemplate[key];
      }
    }

    const updated = await (db as any).call.update({ where: { id }, data: updateData });
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
