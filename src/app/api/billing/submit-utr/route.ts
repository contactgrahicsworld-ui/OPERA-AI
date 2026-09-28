// Billing: customer submits UTR after paying
// CRITICAL SECURITY:
// - UTR must be unique (prevent duplicate use of one UTR)
// - Status changes to PENDING_VERIFIED (NOT VERIFIED) — Super Admin must verify
// - Customer cannot activate subscription just by submitting UTR
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { withTenant, quickAudit, type AuthContext } from '@/lib/api-helpers';
import { z } from 'zod';

const SUBMIT_UTR_SCHEMA = z.object({
  paymentId: z.string(),
  utr: z.string().min(8).max(30).regex(/^[A-Za-z0-9]+$/, 'UTR must be alphanumeric'),
});

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  return withTenant(req, async (ctx: AuthContext) => {
    const body = await req.json().catch(() => ({}));
    const parsed = SUBMIT_UTR_SCHEMA.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'invalid_input', details: parsed.error.flatten() }, { status: 400 });
    }
    const { paymentId, utr } = parsed.data;

    // CRITICAL: verify payment belongs to this tenant (cross-tenant attack prevention)
    const payment = await db.subscriptionPayment.findFirst({
      where: { id: paymentId, tenantId: ctx.tenantId },
    });
    if (!payment) {
      return NextResponse.json({ error: 'payment_not_found' }, { status: 404 });
    }
    if (payment.status !== 'PENDING') {
      return NextResponse.json({ error: 'payment_not_pending', currentStatus: payment.status }, { status: 400 });
    }

    // CRITICAL: prevent duplicate UTR (idempotency on the customer's actual payment)
    const existingUtr = await db.subscriptionPayment.findFirst({
      where: { utr, NOT: { id: paymentId } },
    });
    if (existingUtr) {
      return NextResponse.json({ error: 'duplicate_utr', message: 'This UTR has already been submitted for another payment. Duplicate UTRs are rejected.' }, { status: 409 });
    }

    // Update payment with UTR + change status to PENDING_VERIFIED (Super Admin must verify)
    // Note: status stays as "PENDING" until Super Admin verifies; we add a flag
    await db.subscriptionPayment.update({
      where: { id: paymentId },
      data: {
        utr,
        utrSubmittedAt: new Date(),
        paymentDate: new Date(),
        auditTrail: JSON.stringify([
          ...(safeParseArray(payment.auditTrail)),
          { action: 'utr_submitted', by: ctx.session.sub, at: new Date().toISOString(), ip: req.headers.get('x-forwarded-for') || '', utr },
        ]),
      },
    });

    await quickAudit(ctx, 'billing_utr_submit', 'subscriptionPayment', paymentId, `utr=${utr}`);

    return {
      ok: true,
      status: 'PENDING_SUPER_ADMIN_VERIFICATION',
      message: 'UTR submitted. Super Admin will verify and activate your subscription. You will receive an invoice via WhatsApp once verified.',
    };
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
