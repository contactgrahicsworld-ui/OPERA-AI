// OPERA AI — AI Business Advisor: natural-language Q&A over real tenant data
import { NextRequest } from 'next/server';
import { withTenant, type AuthContext } from '@/lib/api-helpers';
import { askAdvisor } from '@/lib/ai-brain';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  return withTenant(req, async (ctx: AuthContext) => {
    const { question } = await req.json().catch(() => ({}));
    if (!question || typeof question !== 'string') {
      return { error: 'question_required' };
    }
    const answer = await askAdvisor(ctx.tenantId!, question.slice(0, 1000));
    return answer;
  });
}
