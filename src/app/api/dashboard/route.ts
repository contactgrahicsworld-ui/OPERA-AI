// OPERA AI — Dashboard summary (top-of-page metrics)
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { withTenant, type AuthContext } from '@/lib/api-helpers';
import { buildSnapshot } from '@/lib/ai-brain';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  return withTenant(req, async (ctx: AuthContext) => {
    const snapshot = await buildSnapshot(ctx.tenantId!);
    const recentActions = await db.aIAction.findMany({
      where: { tenantId: ctx.tenantId },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { id: true, title: true, status: true, priority: true, category: true, createdAt: true, requiresApproval: true },
    });
    const recentInsights = await db.aIInsight.findMany({
      where: { tenantId: ctx.tenantId },
      orderBy: { generatedAt: 'desc' },
      take: 5,
      select: { id: true, title: true, type: true, priority: true, status: true, generatedAt: true },
    });
    return { snapshot, recentActions, recentInsights };
  });
}
