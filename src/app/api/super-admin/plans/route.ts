// Super Admin: manage plans (create / update / archive) — dynamic pricing control
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { withSuperAdmin, qp, type AuthContext } from '@/lib/api-helpers';
import { z } from 'zod';

const UPSERT_PLAN_SCHEMA = z.object({
  id: z.string().optional(), // if present, update; else create
  name: z.string().min(2).max(50),
  description: z.string().max(500),
  priceMonthly: z.number().int().min(0),
  priceYearly: z.number().int().min(0),
  trialDays: z.number().int().min(0).max(60),
  maxUsers: z.number().int().min(1).max(10000),
  maxStorageMb: z.number().int().min(10).max(102400),
  maxAiCalls: z.number().int().min(0).max(1000000),
  featuresCsv: z.string().max(2000).default(''),
  isDefault: z.boolean().default(false),
  isActive: z.boolean().default(true),
});

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  return withSuperAdmin(req, async (ctx: AuthContext) => {
    const items = await db.plan.findMany({ orderBy: { priceMonthly: 'asc' } });
    return { items };
  });
}

export async function POST(req: NextRequest) {
  return withSuperAdmin(req, async (ctx: AuthContext) => {
    const body = await req.json().catch(() => ({}));
    const parsed = UPSERT_PLAN_SCHEMA.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'invalid_input', details: parsed.error.flatten() }, { status: 400 });
    }
    const d = parsed.data;

    // If isDefault=true, unset other defaults first
    if (d.isDefault) {
      await db.plan.updateMany({ where: { isDefault: true }, data: { isDefault: false } });
    }

    let plan;
    if (d.id) {
      plan = await db.plan.update({
        where: { id: d.id },
        data: {
          name: d.name,
          description: d.description,
          priceMonthly: d.priceMonthly,
          priceYearly: d.priceYearly,
          trialDays: d.trialDays,
          maxUsers: d.maxUsers,
          maxStorageMb: d.maxStorageMb,
          maxAiCalls: d.maxAiCalls,
          featuresCsv: d.featuresCsv,
          isDefault: d.isDefault,
        },
      });
    } else {
      plan = await db.plan.create({
        data: {
          name: d.name,
          description: d.description,
          priceMonthly: d.priceMonthly,
          priceYearly: d.priceYearly,
          trialDays: d.trialDays,
          maxUsers: d.maxUsers,
          maxStorageMb: d.maxStorageMb,
          maxAiCalls: d.maxAiCalls,
          featuresCsv: d.featuresCsv,
          isDefault: d.isDefault,
        },
      });
    }

    await db.auditTrailEntry.create({
      data: {
        tenantId: null,
        userId: ctx.session.sub,
        action: d.id ? 'plan_update' : 'plan_create',
        entity: 'Plan',
        entityId: plan.id,
        details: { name: plan.name, priceMonthly: plan.priceMonthly, priceYearly: plan.priceYearly },
        severity: 'critical',
      },
    });

    return { ok: true, plan };
  });
}

export async function DELETE(req: NextRequest) {
  return withSuperAdmin(req, async (ctx: AuthContext) => {
    const id = qp(req, 'id');
    if (!id) return NextResponse.json({ error: 'id_required' }, { status: 400 });

    // Safety: cannot delete a plan that has active subscriptions
    const tenantCount = await db.tenant.count({ where: { planId: id } });
    if (tenantCount > 0) {
      return NextResponse.json({ error: 'plan_in_use', count: tenantCount }, { status: 400 });
    }
    await db.plan.delete({ where: { id } });
    return { ok: true };
  });
}
