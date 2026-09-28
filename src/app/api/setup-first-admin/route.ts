// First-time Super Admin setup
// Only runs when FIRST_ADMIN_SETUP_DONE = false. Locks permanently after first creation.
// Per spec: NO hardcoded super admin username/email/password/OTP/recovery secret.
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { audit, extractIp } from '@/lib/audit';

const SETUP_SCHEMA = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  whatsappNumber: z.string().regex(/^[0-9]{10,15}$/, 'Must be 10-15 digits (no + prefix)'),
  password: z.string().min(10, 'Password must be at least 10 chars'),
  confirmPassword: z.string(),
  // Simple verification: the deployer sets FIRST_ADMIN_SETUP_KEY env var; the setup-UI must provide the same.
  // This prevents random visitors from claiming super admin even if FIRST_ADMIN_SETUP_DONE is still false.
  setupKey: z.string().min(10),
});

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const parsed = SETUP_SCHEMA.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_input', details: parsed.error.flatten() }, { status: 400 });
  }
  const d = parsed.data;
  if (d.password !== d.confirmPassword) {
    return NextResponse.json({ error: 'password_mismatch' }, { status: 400 });
  }

  // Verify setupKey matches the env var
  const expectedKey = process.env.FIRST_ADMIN_SETUP_KEY;
  if (!expectedKey || d.setupKey !== expectedKey) {
    return NextResponse.json({ error: 'invalid_setup_key' }, { status: 403 });
  }

  // Verify setup hasn't already been done
  const setupDone = await db.platformSetting.findUnique({ where: { key: 'FIRST_ADMIN_SETUP_DONE' } });
  if (setupDone?.value === 'true') {
    return NextResponse.json({ error: 'setup_locked', message: 'First super admin has already been created. Use the super-admin recovery flow if you lost access.' }, { status: 403 });
  }

  // Verify email is not already in use
  const existingUser = await db.user.findUnique({ where: { email: d.email } });
  if (existingUser) {
    return NextResponse.json({ error: 'email_taken' }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(d.password, 12);

  // Use a transaction to ensure atomic creation
  const user = await db.$transaction(async (tx) => {
    const u = await tx.user.create({
      data: {
        email: d.email,
        passwordHash,
        name: d.name,
        role: 'SUPER_ADMIN',
        isSuperAdmin: true,
        status: 'active',
      },
    });

    // Lock the setup
    await tx.platformSetting.upsert({
      where: { key: 'FIRST_ADMIN_SETUP_DONE' },
      create: { key: 'FIRST_ADMIN_SETUP_DONE', value: 'true', description: 'Locked after first super admin creation' },
      update: { value: 'true' },
    });

    // Save the registered whatsapp for password recovery
    await tx.platformSetting.upsert({
      where: { key: 'SUPER_ADMIN_EMAIL' },
      create: { key: 'SUPER_ADMIN_EMAIL', value: d.email, description: 'Primary super admin email' },
      update: { value: d.email },
    });
    await tx.platformSetting.upsert({
      where: { key: 'SUPER_ADMIN_WHATSAPP' },
      create: { key: 'SUPER_ADMIN_WHATSAPP', value: d.whatsappNumber, description: 'Super admin registered WhatsApp for password recovery' },
      update: { value: d.whatsappNumber },
    });
    return u;
  });

  // Audit (tenantId is null for platform-level)
  try {
    await db.auditTrailEntry.create({
      data: {
        tenantId: null,
        userId: user.id,
        action: 'first_super_admin_setup',
        entity: 'User',
        entityId: user.id,
        details: { email: d.email, name: d.name, whatsapp: d.whatsappNumber, ip: extractIp(req.headers) },
        ip: extractIp(req.headers),
        userAgent: req.headers.get('user-agent') || '',
        severity: 'critical',
      },
    });
  } catch {}

  return NextResponse.json({ ok: true, userId: user.id, message: 'First Super Admin created. First-time setup is now LOCKED.' });
}

// GET: returns whether first-time setup is needed (no auth required, this is a public setup-status check)
export async function GET() {
  const setupDone = await db.platformSetting.findUnique({ where: { key: 'FIRST_ADMIN_SETUP_DONE' } });
  const saCount = await db.user.count({ where: { isSuperAdmin: true } });
  return NextResponse.json({
    setupRequired: setupDone?.value !== 'true' && saCount === 0,
    setupDone: setupDone?.value === 'true',
    superAdminExists: saCount > 0,
  });
}
