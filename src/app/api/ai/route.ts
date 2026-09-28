// OPERA AI — AI Action Center APIs
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { withTenant, qp, quickAudit, type AuthContext } from '@/lib/api-helpers';
import { generateInsights, executeAction } from '@/lib/ai-brain';
import { isSensitiveAction } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// Generate fresh insights + actions for the current tenant
export async function POST(req: NextRequest) {
  return withTenant(req, async (ctx: AuthContext) => {
    const action = qp(req, 'op', 'generate');
    if (action === 'generate') {
      const created = await generateInsights(ctx.tenantId!);
      await quickAudit(ctx, 'ai_generate', 'ai', '', `insights=${created.insights.length} actions=${created.actions.length}`);
      return { ok: true, insights: created.insights.length, actions: created.actions.length };
    }
    if (action === 'execute') {
      const { actionId } = await req.json().catch(() => ({}));
      if (!actionId) return NextResponse.json({ error: 'actionId_required' }, { status: 400 });
      const act = await db.aIAction.findFirst({ where: { id: actionId, tenantId: ctx.tenantId } });
      if (!act) return NextResponse.json({ error: 'not_found' }, { status: 404 });
      // Sensitive actions ALWAYS require human approval, even if requiresApproval is false.
      if (act.requiresApproval && act.status !== 'approved') {
        return NextResponse.json({ error: 'not_approved' }, { status: 403 });
      }
      const res = await executeAction(actionId, ctx.session.sub, ctx.tenantId!);
      await quickAudit(ctx, 'ai_execute', 'aiAction', actionId, JSON.stringify(res).slice(0, 500));
      return res;
    }
    if (action === 'approve') {
      const { actionId } = await req.json().catch(() => ({}));
      if (!actionId) return NextResponse.json({ error: 'actionId_required' }, { status: 400 });
      const act = await db.aIAction.findFirst({ where: { id: actionId, tenantId: ctx.tenantId } });
      if (!act) return NextResponse.json({ error: 'not_found' }, { status: 404 });
      const updated = await db.aIAction.update({
        where: { id: actionId },
        data: { status: 'approved', approverId: ctx.session.sub, approvedAt: new Date() },
      });
      await quickAudit(ctx, 'ai_approve', 'aiAction', actionId);
      return updated;
    }
    if (action === 'reject') {
      const { actionId } = await req.json().catch(() => ({}));
      if (!actionId) return NextResponse.json({ error: 'actionId_required' }, { status: 400 });
      const act = await db.aIAction.findFirst({ where: { id: actionId, tenantId: ctx.tenantId } });
      if (!act) return NextResponse.json({ error: 'not_found' }, { status: 404 });
      const updated = await db.aIAction.update({
        where: { id: actionId },
        data: { status: 'rejected' },
      });
      await quickAudit(ctx, 'ai_reject', 'aiAction', actionId);
      return updated;
    }
    if (action === 'dismiss') {
      const { insightId, actionId } = await req.json().catch(() => ({}));
      if (actionId) {
        const updated = await db.aIAction.updateMany({
          where: { id: actionId, tenantId: ctx.tenantId! },
          data: { status: 'dismissed' },
        });
        return { ok: true, updated: updated.count };
      }
      if (insightId) {
        const updated = await db.aIInsight.updateMany({
          where: { id: insightId, tenantId: ctx.tenantId! },
          data: { status: 'dismissed' },
        });
        return { ok: true, updated: updated.count };
      }
      return NextResponse.json({ error: 'id_required' }, { status: 400 });
    }
    return NextResponse.json({ error: 'unknown_op' }, { status: 400 });
  });
}

// List current insights + actions (the primary "Action Center" view)
export async function GET(req: NextRequest) {
  return withTenant(req, async (ctx: AuthContext) => {
    const limit = parseInt(qp(req, 'limit', '50'));
    const [insights, actions] = await Promise.all([
      db.aIInsight.findMany({
        where: { tenantId: ctx.tenantId, status: { in: ['active', 'acknowledged'] } },
        orderBy: [{ priority: 'desc' }, { generatedAt: 'desc' }],
        take: Math.min(limit, 100),
      }),
      db.aIAction.findMany({
        where: { tenantId: ctx.tenantId, status: { in: ['pending', 'approved', 'executing', 'failed'] } },
        orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
        take: Math.min(limit, 100),
        include: { insight: true },
      }),
    ]);
    return { insights, actions };
  });
}
