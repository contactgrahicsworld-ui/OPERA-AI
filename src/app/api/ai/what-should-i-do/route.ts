// OPERA AI — "What should I do now?"
import { NextRequest } from 'next/server';
import { withTenant, type AuthContext } from '@/lib/api-helpers';
import { whatShouldIDoNow } from '@/lib/ai-brain';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  return withTenant(req, async (ctx: AuthContext) => {
    return { recommendations: await whatShouldIDoNow(ctx.tenantId!, ctx.session.sub) };
  });
}
