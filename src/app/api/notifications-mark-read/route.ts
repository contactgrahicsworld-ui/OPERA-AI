// OPERA AI — Mark notifications read
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { withTenant, type AuthContext } from '@/lib/api-helpers';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  return withTenant(req, async (ctx: AuthContext) => {
    const { id, all } = await req.json().catch(() => ({}));
    if (all) {
      const r = await db.notification.updateMany({
        where: { tenantId: ctx.tenantId!, isRead: false },
        data: { isRead: true },
      });
      return { ok: true, updated: r.count };
    }
    if (id) {
      await db.notification.updateMany({
        where: { id, tenantId: ctx.tenantId! },
        data: { isRead: true },
      });
      return { ok: true };
    }
    return { error: 'id_or_all_required' };
  });
}
