// OPERA AI — Read-only business snapshot for the Action Center sidebar
import { NextRequest } from 'next/server';
import { withTenant, type AuthContext } from '@/lib/api-helpers';
import { buildSnapshot } from '@/lib/ai-brain';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  return withTenant(req, async (ctx: AuthContext) => {
    return await buildSnapshot(ctx.tenantId!);
  });
}
