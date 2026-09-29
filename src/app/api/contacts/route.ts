// AUTO-GENERATED CRUD route for contacts (PostgreSQL-aware)
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
    if (search && ["name","email","phone"].length > 0) {
      where.OR = ["name","email","phone"].map((f: string) => ({ [f]: { contains: search, mode: 'insensitive' } }));
    }

    const [items, total] = await Promise.all([
      (db as any).contact.findMany({
        where,
        select: { id: true, name: true, email: true, phone: true, position: true, isPrimary: true, tags: true, companyId: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: Math.min(limit, 200),
        skip: offset,
      }),
      (db as any).contact.count({ where }),
    ]);

    return { items, total, limit, offset };
  });
}

export async function POST(req: NextRequest) {
  return withTenant(req, async (ctx: AuthContext) => {
    const d = await req.json().catch(() => ({}));
    const created = await (db as any).contact.create({ data: { tenantId: ctx.tenantId!, name: d.name, email: d.email || '', phone: d.phone || '', companyId: d.companyId || null, position: d.position || '', isPrimary: d.isPrimary || false, tags: d.tags || [] } });
    await quickAudit(ctx, 'create', 'contact', created.id, JSON.stringify(d).slice(0, 500));

    // No workflow trigger for this entity

    return created;
  });
}

export async function PATCH(req: NextRequest) {
  return withTenant(req, async (ctx: AuthContext) => {
    const d = await req.json().catch(() => ({}));
    const id = qp(req, 'id') || d.id;
    if (!id) return NextResponse.json({ error: 'id_required' }, { status: 400 });

    const existing = await (db as any).contact.findFirst({ where: { id, tenantId: ctx.tenantId } });
    if (!existing) return NextResponse.json({ error: 'not_found' }, { status: 404 });

    // Build update data — only include fields that are actually provided
    const updateData: any = {};
    const provided = Object.fromEntries(Object.entries(d).filter(([k, v]) => v !== undefined));
    // Apply our update mapping (functions handle Date conversion)
    const updateTemplate: any = { name: d.name, email: d.email, phone: d.phone, position: d.position, isPrimary: d.isPrimary, tags: d.tags || [] };
    for (const key of Object.keys(provided)) {
      if (key in updateTemplate && updateTemplate[key] !== undefined) {
        updateData[key] = updateTemplate[key];
      }
    }

    const updated = await (db as any).contact.update({ where: { id }, data: updateData });
    await quickAudit(ctx, 'update', 'contact', id, JSON.stringify(d).slice(0, 500));
    return updated;
  });
}

export async function DELETE(req: NextRequest) {
  return withTenant(req, async (ctx: AuthContext) => {
    const id = qp(req, 'id');
    if (!id) return NextResponse.json({ error: 'id_required' }, { status: 400 });
    const existing = await (db as any).contact.findFirst({ where: { id, tenantId: ctx.tenantId } });
    if (!existing) return NextResponse.json({ error: 'not_found' }, { status: 404 });
    await (db as any).contact.delete({ where: { id } });
    await quickAudit(ctx, 'delete', 'contact', id);
    return { ok: true };
  });
}
