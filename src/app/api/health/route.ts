// Production smoke test endpoint — calls this from Vercel deployment
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const checks: Record<string, any> = {};
  const start = Date.now();

  // 1. Database connectivity
  try {
    await db.$queryRaw`SELECT 1 AS ok`;
    checks.database = { ok: true, latencyMs: Date.now() - start };
  } catch (e: any) {
    checks.database = { ok: false, error: e.message };
  }

  // 2. Critical tables exist + count
  try {
    const [tenants, users, plans] = await Promise.all([
      db.tenant.count(),
      db.user.count(),
      db.plan.count(),
    ]);
    checks.tables = { ok: true, tenants, users, plans };
  } catch (e: any) {
    checks.tables = { ok: false, error: e.message };
  }

  // 3. Auth — verify session cookie library works
  try {
    const { getSession } = await import('@/lib/session');
    const session = await getSession();
    checks.auth = { ok: true, sessionPresent: !!session };
  } catch (e: any) {
    checks.auth = { ok: false, error: e.message };
  }

  const allOk = Object.values(checks).every((c: any) => c.ok === true);

  return NextResponse.json({
    status: allOk ? 'ok' : 'degraded',
    app: 'OPERA AI',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    durationMs: Date.now() - start,
    checks,
  }, { status: allOk ? 200 : 503 });
}
