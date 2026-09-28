// Super Admin: verify a UTR (after manual bank/UPI reconciliation)
// - Status changes PENDING → VERIFIED
// - Subscription becomes ACTIVE
// - Invoice is generated (idempotent — no duplicate for same payment)
// - WhatsApp delivery attempted
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { withSuperAdmin, type AuthContext } from '@/lib/api-helpers';
import { z } from 'zod';
import { generateInvoice, deliverInvoiceViaWhatsApp } from '@/lib/billing';

const VERIFY_SCHEMA = z.object({
  paymentId: z.string(),
});

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  return withSuperAdmin(req, async (ctx: AuthContext) => {
    const body = await req.json().catch(() => ({}));
    const parsed = VERIFY_SCHEMA.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'invalid_input' }, { status: 400 });
    }
    const { paymentId } = parsed.data;

    const payment = await db.subscriptionPayment.findUnique({
      where: { id: paymentId },
      include: { tenant: true, invoice: true },
    });
    if (!payment) {
      return NextResponse.json({ error: 'payment_not_found' }, { status: 404 });
    }
    if (payment.status === 'VERIFIED') {
      return NextResponse.json({ error: 'already_verified', invoiceId: payment.invoiceId }, { status: 400 });
    }
    if (payment.status === 'REJECTED' || payment.status === 'REFUNDED') {
      return NextResponse.json({ error: 'cannot_verify_rejected' }, { status: 400 });
    }
    if (!payment.utr) {
      return NextResponse.json({ error: 'no_utr_submitted' }, { status: 400 });
    }

    // Transaction: verify + activate subscription + generate invoice
    const now = new Date();
    const startDate = now;
    const expiryDate = new Date(now.getTime() + payment.durationDaysSnapshot * 24 * 60 * 60 * 1000);

    // Get plan for activation
    const plan = await db.plan.findUnique({ where: { id: payment.planId } });

    const result = await db.$transaction(async (tx) => {
      // 1. Mark payment VERIFIED
      const updated = await tx.subscriptionPayment.update({
        where: { id: paymentId },
        data: {
          status: 'VERIFIED',
          verifiedById: ctx.session.sub,
          verifiedAt: now,
          auditTrail: JSON.stringify([
            ...(safeParseArray(payment.auditTrail)),
            { action: 'verified', by: ctx.session.sub, at: now.toISOString(), ip: req.headers.get('x-forwarded-for') || '' },
          ]),
        },
      });

      // 2. Activate subscription (idempotent: if subscription already exists for this payment, just update)
      let subscription = await tx.subscription.findFirst({
        where: { tenantId: payment.tenantId },
        orderBy: { createdAt: 'desc' },
      });
      if (subscription) {
        subscription = await tx.subscription.update({
          where: { id: subscription.id },
          data: {
            planId: payment.planId,
            status: 'active',
            startedAt: now,
            endsAt: expiryDate,
            amount: payment.finalAmountSnapshot,
            billingCycle: payment.billingCycleSnapshot,
          },
        });
      } else {
        subscription = await tx.subscription.create({
          data: {
            tenantId: payment.tenantId,
            planId: payment.planId,
            status: 'active',
            startedAt: now,
            endsAt: expiryDate,
            amount: payment.finalAmountSnapshot,
            billingCycle: payment.billingCycleSnapshot,
          },
        });
      }

      // Link subscription ID on payment
      await tx.subscriptionPayment.update({
        where: { id: paymentId },
        data: { subscriptionId: subscription.id },
      });

      // 3. Update tenant status + trial ends
      await tx.tenant.update({
        where: { id: payment.tenantId },
        data: {
          status: 'active',
          planId: payment.planId,
          trialEndsAt: null,
        },
      });

      // 4. Generate invoice (idempotent — check if invoice already exists for this payment)
      let invoice = await tx.subscriptionInvoice.findUnique({ where: { paymentId } });
      if (!invoice) {
        // Get super admin info from platform settings
        const saName = ctx.session.name || 'Super Admin';
        const saContactSetting = await tx.platformSetting.findUnique({ where: { key: 'SUPER_ADMIN_WHATSAPP' } });
        const saGstSetting = await tx.platformSetting.findUnique({ where: { key: 'SUPER_ADMIN_GST' } });
        const taxRateSetting = await tx.platformSetting.findUnique({ where: { key: 'DEFAULT_TAX_RATE_PERCENT' } });
        const taxRate = taxRateSetting ? parseInt(taxRateSetting.value) || 0 : 0;
        const taxAmount = Math.round(payment.finalAmountSnapshot * taxRate / 100);
        const totalWithTax = payment.finalAmountSnapshot + taxAmount;

        // Generate unique invoice number: INV-YYYY-NNNNN (counter-style)
        const yearStr = now.getFullYear();
        const countThisYear = await tx.subscriptionInvoice.count({
          where: { invoiceNumber: { startsWith: `INV-${yearStr}-` } },
        });
        const invoiceNumber = `INV-${yearStr}-${String(countThisYear + 1).padStart(5, '0')}`;

        // Get company info from tenant's business profile
        const businessProfile = await tx.businessProfile.findUnique({ where: { tenantId: payment.tenantId } });
        const companyName = businessProfile?.businessName || payment.tenant.name;
        const companyContact = businessProfile ? `${businessProfile.businessName} (via OPERA AI)` : '';
        const companyGstSetting = await tx.platformSetting.findUnique({ where: { key: `TENANT_GST_${payment.tenantId}` } });

        invoice = await tx.subscriptionInvoice.create({
          data: {
            tenantId: payment.tenantId,
            paymentId,
            invoiceNumber,
            invoiceDate: now,
            companyName,
            companyAddress: businessProfile?.locations || '',
            companyContact: businessProfile ? `${businessProfile.businessName}` : '',
            companyGst: companyGstSetting?.value || '',
            planName: payment.planNameSnapshot,
            durationDays: payment.durationDaysSnapshot,
            startDate,
            expiryDate,
            originalAmount: payment.priceSnapshot,
            discountAmount: payment.discountSnapshot,
            finalAmount: payment.finalAmountSnapshot,
            paymentMethod: 'UPI',
            utr: payment.utr!,
            paymentDate: payment.paymentDate || now,
            superAdminName: saName,
            superAdminBusinessName: 'OPERA AI',
            superAdminContact: saContactSetting?.value || '',
            superAdminGst: saGstSetting?.value || '',
            taxRate,
            taxAmount,
            totalWithTax,
            whatsappStatus: 'NOT_CONFIGURED',
          },
        });

        // Link invoice to payment
        await tx.subscriptionPayment.update({
          where: { id: paymentId },
          data: { invoiceId: invoice.id },
        });
      }

      return { payment: updated, invoice };
    });

    // 5. Attempt WhatsApp delivery (outside transaction so failures don't roll back verification)
    let whatsappResult: { status: string; message: string } = { status: 'NOT_CONFIGURED', message: 'WhatsApp not configured' };
    try {
      whatsappResult = await deliverInvoiceViaWhatsApp(result.invoice.id, ctx);
    } catch (e: any) {
      whatsappResult = { status: 'FAILED', message: e.message };
    }

    // Audit
    await db.auditTrailEntry.create({
      data: {
        tenantId: payment.tenantId,
        userId: ctx.session.sub,
        action: 'payment_verified',
        entity: 'subscriptionPayment',
        entityId: paymentId,
        details: { invoiceId: result.invoice.id, invoiceNumber: result.invoice.invoiceNumber, whatsappStatus: whatsappResult.status },
        ip: req.headers.get('x-forwarded-for') || '',
        userAgent: req.headers.get('user-agent') || '',
        severity: 'critical',
      },
    });

    return {
      ok: true,
      paymentId,
      status: 'VERIFIED',
      invoiceId: result.invoice.id,
      invoiceNumber: result.invoice.invoiceNumber,
      startDate,
      expiryDate,
      whatsappStatus: whatsappResult.status,
      whatsappMessage: whatsappResult.message,
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
