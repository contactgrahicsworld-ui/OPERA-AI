// AUTO-GENERATED CRUD route for leads (PostgreSQL-aware)
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
    if (search && ["name","email","phone","company"].length > 0) {
      where.OR = ["name","email","phone","company"].map((f: string) => ({ [f]: { contains: search, mode: 'insensitive' } }));
    }

    const [items, total] = await Promise.all([
      (db as any).lead.findMany({
        where,
        select: { id: true, name: true, email: true, phone: true, company: true, status: true, stage: true, ownerId: true, value: true, priority: true, tags: true, notes: true, lastActivityAt: true, convertedAt: true, createdAt: true, updatedAt: true },
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
    const created = await (db as any).lead.create({ data: { tenantId: ctx.tenantId!, name: d.name, email: d.email || '', phone: d.phone || '', company: d.company || '', source: d.source || 'manual', status: d.status || 'New', stage: d.stage || 'New', ownerId: d.ownerId || null, value: d.value || 0, priority: d.priority || 'medium', tags: d.tags || [], notes: d.notes || '' } });
    await quickAudit(ctx, 'create', 'lead', created.id, JSON.stringify(d).slice(0, 500));

    // Fire workflow trigger
    if (created.id) {
      try {
        await runWorkflow({
          tenantId: ctx.tenantId!,
          trigger: "new_lead",
          entityRef: { entity: 'lead', id: created.id },
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

    const existing = await (db as any).lead.findFirst({ where: { id, tenantId: ctx.tenantId } });
    if (!existing) return NextResponse.json({ error: 'not_found' }, { status: 404 });

    // Build update data — only include fields that are actually provided
    const updateData: any = {};
    const provided = Object.fromEntries(Object.entries(d).filter(([k, v]) => v !== undefined));
    // Apply our update mapping (functions handle Date conversion)
    const updateTemplate: any = { name: d.name, email: d.email, phone: d.phone, company: d.company, source: d.source, status: d.status, stage: d.stage, ownerId: d.ownerId, value: d.value, priority: d.priority, tags: d.tags || [], notes: d.notes, lastActivityAt: d.lastActivityAt ? new Date(d.lastActivityAt) : undefined };
    for (const key of Object.keys(provided)) {
      if (key in updateTemplate && updateTemplate[key] !== undefined) {
        updateData[key] = updateTemplate[key];
      }
    }

    const updated = await (db as any).lead.update({ where: { id }, data: updateData });
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
