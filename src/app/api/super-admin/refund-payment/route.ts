// Super Admin: record a refund for a previously verified payment
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { withSuperAdmin, type AuthContext } from '@/lib/api-helpers';
import { z } from 'zod';

const REFUND_SCHEMA = z.object({
  paymentId: z.string(),
  refundAmount: z.number().int().positive(),
  refundReason: z.string().min(5).max(500),
});

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  return withSuperAdmin(req, async (ctx: AuthContext) => {
    const body = await req.json().catch(() => ({}));
    const parsed = REFUND_SCHEMA.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'invalid_input' }, { status: 400 });
    }
    const { paymentId, refundAmount, refundReason } = parsed.data;

    const payment = await db.subscriptionPayment.findUnique({ where: { id: paymentId } });
    if (!payment) return NextResponse.json({ error: 'payment_not_found' }, { status: 404 });
    if (payment.status !== 'VERIFIED') return NextResponse.json({ error: 'can_only_refund_verified' }, { status: 400 });
    if (refundAmount > payment.finalAmountSnapshot) {
      return NextResponse.json({ error: 'refund_exceeds_payment', refundAmount, finalAmount: payment.finalAmountSnapshot }, { status: 400 });
    }

    const updated = await db.subscriptionPayment.update({
      where: { id: paymentId },
      data: {
        status: 'REFUNDED',
        refundStatus: 'PROCESSED',
        refundAmount,
        refundReason,
        refundProcessedAt: new Date(),
        auditTrail: JSON.stringify([
          ...(safeParseArray(payment.auditTrail)),
          { action: 'refund_processed', by: ctx.session.sub, at: new Date().toISOString(), ip: req.headers.get('x-forwarded-for') || '', refundAmount, refundReason },
        ]),
      },
    });

    // Suspend the tenant's subscription
    const subscription = await db.subscription.findFirst({
      where: { tenantId: payment.tenantId },
      orderBy: { createdAt: 'desc' },
    });
    if (subscription) {
      await db.subscription.update({
        where: { id: subscription.id },
        data: { status: 'cancelled', endsAt: new Date() },
      });
    }
    // Also set tenant to suspended (they can re-purchase)
    await db.tenant.update({
      where: { id: payment.tenantId },
      data: { status: 'suspended' },
    });

    await db.auditTrailEntry.create({
      data: {
        tenantId: payment.tenantId,
        userId: ctx.session.sub,
        action: 'payment_refunded',
        entity: 'subscriptionPayment',
        entityId: paymentId,
        details: { refundAmount, refundReason, originalUtr: payment.utr },
        ip: req.headers.get('x-forwarded-for') || '',
        userAgent: req.headers.get('user-agent') || '',
        severity: 'critical',
      },
    });

    return { ok: true, paymentId, status: 'REFUNDED', refundAmount };
  });
}

function safeParseArray(s: any): any[] {
  if (!s) return [];
  if (Array.isArray(s)) return s;
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}
