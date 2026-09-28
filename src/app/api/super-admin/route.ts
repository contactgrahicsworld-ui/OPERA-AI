// OPERA AI — Super Admin: tenant management, plans, etc.
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { withSuperAdmin, qp, type AuthContext } from '@/lib/api-helpers';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  return withSuperAdmin(req, async (ctx: AuthContext) => {
    const op = qp(req, 'op', 'overview');
    if (op === 'overview') {
      const [tenants, users, plans, aiCalls] = await Promise.all([
        db.tenant.count(),
        db.user.count(),
        db.plan.count(),
        db.aIUsageRecord.count(),
      ]);
      return { tenants, users, plans, aiCalls };
    }
    if (op === 'tenants') {
      const items = await db.tenant.findMany({
        include: { plan: true, _count: { select: { users: true } } },
        orderBy: { createdAt: 'desc' },
      });
      return { items };
    }
    if (op === 'plans') {
      const items = await db.plan.findMany({ orderBy: { priceMonthly: 'asc' } });
      return { items };
    }
    if (op === 'audit') {
      const limit = parseInt(qp(req, 'limit', '100'));
      const items = await db.auditLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: Math.min(limit, 500),
        include: { tenant: { select: { name: true, slug: true } } },
      });
      return { items };
    }
    if (op === 'ai_usage') {
      const days = parseInt(qp(req, 'days', '7'));
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      const records = await db.aIUsageRecord.findMany({
        where: { createdAt: { gte: since } },
        select: { provider: true, feature: true, success: true, latencyMs: true, promptTokens: true, completionTokens: true, tenantId: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 500,
      });
      return { records };
    }
    return NextResponse.json({ error: 'unknown_op' }, { status: 400 });
  });
}

export async function POST(req: NextRequest) {
  return withSuperAdmin(req, async (ctx: AuthContext) => {
    const op = qp(req, 'op', 'suspend');
    const body = await req.json().catch(() => ({}));
    if (op === 'suspend') {
      const { tenantId } = body;
      if (!tenantId) return { error: 'tenantId_required' };
      await db.tenant.update({ where: { id: tenantId }, data: { status: 'suspended' } });
      return { ok: true };
    }
    if (op === 'activate') {
      const { tenantId } = body;
      if (!tenantId) return { error: 'tenantId_required' };
      await db.tenant.update({ where: { id: tenantId }, data: { status: 'active' } });
      return { ok: true };
    }
    if (op === 'plan_upsert') {
      const { id, name, description, priceMonthly, priceYearly, trialDays, maxUsers, maxStorageMb, maxAiCalls, featuresCsv, isDefault } = body;
      if (!name) return { error: 'name_required' };
      if (id) {
        const updated = await db.plan.update({ where: { id }, data: { name, description, priceMonthly, priceYearly, trialDays, maxUsers, maxStorageMb, maxAiCalls, featuresCsv, isDefault } });
        return { ok: true, id: updated.id };
      }
      const created = await db.plan.create({ data: { name, description, priceMonthly, priceYearly, trialDays, maxUsers, maxStorageMb, maxAiCalls, featuresCsv, isDefault } });
      return { ok: true, id: created.id };
    }
    if (op === 'plan_delete') {
      const { id } = body;
      if (!id) return { error: 'id_required' };
      // Safety: cannot delete a plan that has tenants
      const tenantCount = await db.tenant.count({ where: { planId: id } });
      if (tenantCount > 0) return { error: 'plan_in_use', count: tenantCount };
      await db.plan.delete({ where: { id } });
      return { ok: true };
    }
    return { error: 'unknown_op' };
  });
}
