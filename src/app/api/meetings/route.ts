// AUTO-GENERATED CRUD route for meetings (PostgreSQL-aware)
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
    if (search && ["title","notes"].length > 0) {
      where.OR = ["title","notes"].map((f: string) => ({ [f]: { contains: search, mode: 'insensitive' } }));
    }

    const [items, total] = await Promise.all([
      (db as any).meeting.findMany({
        where,
        select: { id: true, title: true, leadId: true, customerId: true, attendeeIds: true, location: true, scheduledAt: true, endedAt: true, notes: true, outcome: true, ownerId: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: Math.min(limit, 200),
        skip: offset,
      }),
      (db as any).meeting.count({ where }),
    ]);

    return { items, total, limit, offset };
  });
}

export async function POST(req: NextRequest) {
  return withTenant(req, async (ctx: AuthContext) => {
    const d = await req.json().catch(() => ({}));
    const created = await (db as any).meeting.create({ data: { tenantId: ctx.tenantId!, title: d.title, leadId: d.leadId || null, customerId: d.customerId || null, attendeeIds: d.attendeeIds || [], location: d.location || '', scheduledAt: d.scheduledAt ? new Date(d.scheduledAt) : new Date(), endedAt: d.endedAt ? new Date(d.endedAt) : null, notes: d.notes || '', outcome: d.outcome || '', ownerId: ctx.session.sub } });
    await quickAudit(ctx, 'create', 'meeting', created.id, JSON.stringify(d).slice(0, 500));

    // No workflow trigger for this entity

    return created;
  });
}

export async function PATCH(req: NextRequest) {
  return withTenant(req, async (ctx: AuthContext) => {
    const d = await req.json().catch(() => ({}));
    const id = qp(req, 'id') || d.id;
    if (!id) return NextResponse.json({ error: 'id_required' }, { status: 400 });

    const existing = await (db as any).meeting.findFirst({ where: { id, tenantId: ctx.tenantId } });
    if (!existing) return NextResponse.json({ error: 'not_found' }, { status: 404 });

    // Build update data — only include fields that are actually provided
    const updateData: any = {};
    const provided = Object.fromEntries(Object.entries(d).filter(([k, v]) => v !== undefined));
    // Apply our update mapping (functions handle Date conversion)
    const updateTemplate: any = { title: d.title, attendeeIds: d.attendeeIds || [], location: d.location, scheduledAt: d.scheduledAt ? new Date(d.scheduledAt) : undefined, endedAt: d.endedAt ? new Date(d.endedAt) : null, notes: d.notes, outcome: d.outcome };
    for (const key of Object.keys(provided)) {
      if (key in updateTemplate && updateTemplate[key] !== undefined) {
        updateData[key] = updateTemplate[key];
      }
    }

    const updated = await (db as any).meeting.update({ where: { id }, data: updateData });
    await quickAudit(ctx, 'update', 'meeting', id, JSON.stringify(d).slice(0, 500));
    return updated;
  });
}

export async function DELETE(req: NextRequest) {
  return withTenant(req, async (ctx: AuthContext) => {
    const id = qp(req, 'id');
    if (!id) return NextResponse.json({ error: 'id_required' }, { status: 400 });
    const existing = await (db as any).meeting.findFirst({ where: { id, tenantId: ctx.tenantId } });
    if (!existing) return NextResponse.json({ error: 'not_found' }, { status: 404 });
    await (db as any).meeting.delete({ where: { id } });
    await quickAudit(ctx, 'delete', 'meeting', id);
    return { ok: true };
  });
}
