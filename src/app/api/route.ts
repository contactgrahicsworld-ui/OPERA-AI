// Bootstrap / health check — also runs seed on first load.
import { NextResponse } from 'next/server';
import { ensureSeedData } from '@/lib/seed';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await ensureSeedData();
    const counts = {
      plans: await db.plan.count(),
      users: await db.user.count(),
      tenants: await db.tenant.count(),
    };
    return NextResponse.json({
      status: 'ok',
      app: 'OPERA AI',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      counts,
    });
  } catch (e) {
    return NextResponse.json({ status: 'error', error: (e as Error).message }, { status: 500 });
  }
}
