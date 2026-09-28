// Verify the recovery code (without resetting password yet — keeps the flow explicit)
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import bcrypt from 'bcryptjs';
import { z } from 'zod';

const VERIFY_SCHEMA = z.object({
  recoveryId: z.string(),
  code: z.string().regex(/^[0-9]{6}$/, 'Code must be 6 digits'),
});

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const parsed = VERIFY_SCHEMA.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_input' }, { status: 400 });
  }
  const { recoveryId, code } = parsed.data;

  const recovery = await db.passwordRecovery.findUnique({ where: { id: recoveryId } });
  if (!recovery) {
    return NextResponse.json({ error: 'invalid_recovery_id' }, { status: 404 });
  }
  if (recovery.consumedAt) {
    return NextResponse.json({ error: 'code_already_used' }, { status: 410 });
  }
  if (recovery.expiresAt < new Date()) {
    return NextResponse.json({ error: 'code_expired' }, { status: 410 });
  }
  if (recovery.attempts >= recovery.maxAttempts) {
    return NextResponse.json({ error: 'max_attempts_reached' }, { status: 429 });
  }

  // Increment attempt count
  await db.passwordRecovery.update({
    where: { id: recoveryId },
    data: { attempts: { increment: 1 } },
  });

  const ok = await bcrypt.compare(code, recovery.codeHash);
  if (!ok) {
    const remaining = recovery.maxAttempts - (recovery.attempts + 1);
    return NextResponse.json({ error: 'invalid_code', attemptsRemaining: Math.max(0, remaining) }, { status: 400 });
  }

  // Mark as consumed
  await db.passwordRecovery.update({
    where: { id: recoveryId },
    data: { consumedAt: new Date() },
  });

  return NextResponse.json({ ok: true, verified: true, recoveryId });
}
