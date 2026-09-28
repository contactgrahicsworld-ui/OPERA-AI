// OPERA AI — Plans (public list for signup page)
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const items = await db.plan.findMany({ orderBy: { priceMonthly: 'asc' } });
  return Response.json({ items });
}
