// Super Admin: set/update own contact info (WhatsApp + email) for password recovery
// Per spec: NO hardcoded credentials. Super Admin sets their own contact info via this endpoint.
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { withSuperAdmin, type AuthContext } from '@/lib/api-helpers';
import { z } from 'zod';

const UPDATE_SCHEMA = z.object({
  whatsappNumber: z.string().regex(/^[0-9]{10,15}$/, 'WhatsApp must be 10-15 digits').optional(),
  contactEmail: z.string().email().optional(),
});

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  return withSuperAdmin(req, async (ctx: AuthContext) => {
    const [wa, email, upi, upiName] = await Promise.all([
      db.platformSetting.findUnique({ where: { key: 'SUPER_ADMIN_WHATSAPP' } }),
      db.platformSetting.findUnique({ where: { key: 'SUPER_ADMIN_EMAIL' } }),
      db.platformSetting.findUnique({ where: { key: 'UPI_RECEIVER' } }),
      db.platformSetting.findUnique({ where: { key: 'UPI_RECEIVER_NAME' } }),
    ]);
    return {
      whatsappNumber: wa?.value || '',
      contactEmail: email?.value || '',
      upiReceiver: upi?.value || 'NOT_CONFIGURED',
      upiReceiverName: upiName?.value || '',
    };
  });
}

export async function POST(req: NextRequest) {
  return withSuperAdmin(req, async (ctx: AuthContext) => {
    const body = await req.json().catch(() => ({}));
    const parsed = UPDATE_SCHEMA.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'invalid_input', details: parsed.error.flatten() }, { status: 400 });
    }
    const d = parsed.data;

    if (d.whatsappNumber) {
      await db.platformSetting.upsert({
        where: { key: 'SUPER_ADMIN_WHATSAPP' },
        create: { key: 'SUPER_ADMIN_WHATSAPP', value: d.whatsappNumber, description: 'Super Admin registered WhatsApp for password recovery' },
        update: { value: d.whatsappNumber, updatedById: ctx.session.sub, updatedAt: new Date() },
      });
    }
    if (d.contactEmail) {
      await db.platformSetting.upsert({
        where: { key: 'SUPER_ADMIN_EMAIL' },
        create: { key: 'SUPER_ADMIN_EMAIL', value: d.contactEmail, description: 'Primary super admin email' },
        update: { value: d.contactEmail, updatedById: ctx.session.sub, updatedAt: new Date() },
      });
    }

    await db.auditTrailEntry.create({
      data: {
        tenantId: null,
        userId: ctx.session.sub,
        action: 'super_admin_contact_update',
        entity: 'PlatformSetting',
        entityId: 'SUPER_ADMIN_CONTACT',
        details: { whatsapp_set: !!d.whatsappNumber, email_set: !!d.contactEmail },
        ip: req.headers.get('x-forwarded-for') || '',
        userAgent: req.headers.get('user-agent') || '',
        severity: 'critical',
      },
    });

    return { ok: true };
  });
}
