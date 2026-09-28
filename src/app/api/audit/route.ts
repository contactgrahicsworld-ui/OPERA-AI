// OPERA AI — Audit log (read-only for tenant)
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { withTenant, qp, type AuthContext } from '@/lib/api-helpers';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  return withTenant(req, async (ctx: AuthContext) => {
    const limit = parseInt(qp(req, 'limit', '100'));
    const action = qp(req, 'action');
    const where: any = { tenantId: ctx.tenantId };
    if (action) where.action = action;
    const items = await db.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 500),
    });
    return { items };
  });
}
