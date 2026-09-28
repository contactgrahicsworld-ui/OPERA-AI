// Super Admin: reject a payment (with reason)
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { withSuperAdmin, type AuthContext } from '@/lib/api-helpers';
import { z } from 'zod';

const REJECT_SCHEMA = z.object({
  paymentId: z.string(),
  reason: z.string().min(5).max(500),
});

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  return withSuperAdmin(req, async (ctx: AuthContext) => {
    const body = await req.json().catch(() => ({}));
    const parsed = REJECT_SCHEMA.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'invalid_input', details: parsed.error.flatten() }, { status: 400 });
    }
    const { paymentId, reason } = parsed.data;

    const payment = await db.subscriptionPayment.findUnique({ where: { id: paymentId } });
    if (!payment) return NextResponse.json({ error: 'payment_not_found' }, { status: 404 });
    if (payment.status === 'VERIFIED') return NextResponse.json({ error: 'cannot_reject_verified' }, { status: 400 });
    if (payment.status === 'REFUNDED') return NextResponse.json({ error: 'cannot_reject_refunded' }, { status: 400 });

    const updated = await db.subscriptionPayment.update({
      where: { id: paymentId },
      data: {
        status: 'REJECTED',
        rejectionReason: reason,
        auditTrail: JSON.stringify([
          ...(safeParseArray(payment.auditTrail)),
          { action: 'rejected', by: ctx.session.sub, at: new Date().toISOString(), ip: req.headers.get('x-forwarded-for') || '', reason },
        ]),
      },
    });

    await db.auditTrailEntry.create({
      data: {
        tenantId: payment.tenantId,
        userId: ctx.session.sub,
        action: 'payment_rejected',
        entity: 'subscriptionPayment',
        entityId: paymentId,
        details: { reason, utr: payment.utr },
        ip: req.headers.get('x-forwarded-for') || '',
        userAgent: req.headers.get('user-agent') || '',
        severity: 'critical',
      },
    });

    return { ok: true, paymentId, status: 'REJECTED', reason };
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
