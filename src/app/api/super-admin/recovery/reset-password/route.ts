// Reset super admin password (after recovery code verified)
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import bcrypt from 'bcryptjs';
import { z } from 'zod';

const RESET_SCHEMA = z.object({
  recoveryId: z.string(),
  code: z.string().regex(/^[0-9]{6}$/),
  newPassword: z.string().min(10),
  confirmPassword: z.string(),
});

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const parsed = RESET_SCHEMA.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_input' }, { status: 400 });
  }
  const { recoveryId, code, newPassword, confirmPassword } = parsed.data;
  if (newPassword !== confirmPassword) {
    return NextResponse.json({ error: 'password_mismatch' }, { status: 400 });
  }

  // Re-verify the code (defense-in-depth)
  const recovery = await db.passwordRecovery.findUnique({ where: { id: recoveryId } });
  if (!recovery || recovery.consumedAt || recovery.expiresAt < new Date()) {
    return NextResponse.json({ error: 'recovery_invalid_or_expired' }, { status: 410 });
  }
  const ok = await bcrypt.compare(code, recovery.codeHash);
  if (!ok) {
    return NextResponse.json({ error: 'invalid_code' }, { status: 400 });
  }

  // Find user (must be super admin)
  if (!recovery.userId) {
    return NextResponse.json({ error: 'recovery_has_no_user' }, { status: 500 });
  }
  const user = await db.user.findUnique({ where: { id: recovery.userId } });
  if (!user || !user.isSuperAdmin) {
    return NextResponse.json({ error: 'not_super_admin' }, { status: 403 });
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);
  await db.user.update({ where: { id: user.id }, data: { passwordHash, updatedAt: new Date() } });

  // Invalidate ALL recovery codes for this email (defense-in-depth)
  await db.passwordRecovery.updateMany({
    where: { email: user.email, consumedAt: null },
    data: { consumedAt: new Date() },
  });

  // Audit
  await db.auditTrailEntry.create({
    data: {
      tenantId: null,
      userId: user.id,
      action: 'password_reset_via_recovery',
      entity: 'User',
      entityId: user.id,
      details: { email: user.email, recoveryId },
      ip: req.headers.get('x-forwarded-for') || '',
      userAgent: req.headers.get('user-agent') || '',
      severity: 'critical',
    },
  });

  return NextResponse.json({ ok: true, message: 'Password reset. You can now sign in with the new password.' });
}
