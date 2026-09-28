// Super Admin: get/set UPI receiver
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { withSuperAdmin, type AuthContext } from '@/lib/api-helpers';
import { setUpiReceiver, getUpiReceiver } from '@/lib/billing';
import { z } from 'zod';

const SET_UPI_SCHEMA = z.object({
  upiReceiver: z.string().min(5).max(100),
});

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  return withSuperAdmin(req, async (ctx: AuthContext) => {
    const upi = await getUpiReceiver();
    const setting = await db.platformSetting.findUnique({ where: { key: 'UPI_RECEIVER' } });
    return {
      upiReceiver: upi,
      updatedAt: setting?.updatedAt || null,
      updatedById: setting?.updatedById || null,
    };
  });
}

export async function POST(req: NextRequest) {
  return withSuperAdmin(req, async (ctx: AuthContext) => {
    const body = await req.json().catch(() => ({}));
    const parsed = SET_UPI_SCHEMA.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'invalid_input' }, { status: 400 });
    }
    try {
      await setUpiReceiver(parsed.data.upiReceiver, ctx);
      return { ok: true, upiReceiver: parsed.data.upiReceiver };
    } catch (e: any) {
      return NextResponse.json({ error: 'invalid_upi', message: e.message }, { status: 400 });
    }
  });
}
