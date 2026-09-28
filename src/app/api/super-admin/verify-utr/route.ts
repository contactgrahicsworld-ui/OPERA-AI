// Super Admin: verify a UTR (after manual bank/UPI reconciliation)
// - Status changes PENDING → VERIFIED
// - Subscription becomes ACTIVE
// - Invoice is generated (idempotent — no duplicate for same payment)
// - WhatsApp delivery attempted
//
// NOTE: We avoid db.$transaction(async (tx) => ...) because Supabase's pgbouncer
// (in transaction mode) doesn't support Prisma interactive transactions reliably.
// Instead, we use sequential queries with idempotency checks (invoice exists check,
// subscription exists check) — equivalent guarantees without transactional coupling.
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { withSuperAdmin, type AuthContext } from '@/lib/api-helpers';
import { z } from 'zod';
import { deliverInvoiceViaWhatsApp } from '@/lib/billing';

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

    // Re-fetch payment fresh (avoid stale state)
    const payment = await db.subscriptionPayment.findUnique({
      where: { id: paymentId },
      include: { tenant: true, invoice: true },
    });
    if (!payment) {
      return NextResponse.json({ error: 'payment_not_found' }, { status: 404 });
    }
    if (payment.status === 'VERIFIED') {
      // Idempotent: already verified — return existing invoice
      return {
        ok: true,
        paymentId,
        status: 'VERIFIED',
        invoiceId: payment.invoiceId,
        invoiceNumber: payment.invoice?.invoiceNumber,
        message: 'Already verified (idempotent response)',
        whatsappStatus: payment.whatsappStatus,
      };
    }
    if (payment.status === 'REJECTED' || payment.status === 'REFUNDED') {
      return NextResponse.json({ error: 'cannot_verify_rejected' }, { status: 400 });
    }
    if (!payment.utr) {
      return NextResponse.json({ error: 'no_utr_submitted' }, { status: 400 });
    }

    const now = new Date();
    const startDate = now;
    const expiryDate = new Date(now.getTime() + payment.durationDaysSnapshot * 24 * 60 * 60 * 1000);

    // STEP 1: Mark payment VERIFIED
    const auditTrailArray: any[] = safeParseArray(payment.auditTrail);
    auditTrailArray.push({
      action: 'verified',
      by: ctx.session.sub,
      at: now.toISOString(),
      ip: req.headers.get('x-forwarded-for') || '',
    });
    const updatedPayment = await db.subscriptionPayment.update({
      where: { id: paymentId },
      data: {
        status: 'VERIFIED',
        verifiedById: ctx.session.sub,
        verifiedAt: now,
        auditTrail: auditTrailArray as any,
      },
    });

    // STEP 2: Activate subscription (upsert by tenant)
    let subscription = await db.subscription.findFirst({
      where: { tenantId: payment.tenantId },
      orderBy: { createdAt: 'desc' },
    });
    if (subscription) {
      subscription = await db.subscription.update({
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
      subscription = await db.subscription.create({
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

    // Link subscription on payment
    await db.subscriptionPayment.update({
      where: { id: paymentId },
      data: { subscriptionId: subscription.id },
    });

    // STEP 3: Activate tenant
    await db.tenant.update({
      where: { id: payment.tenantId },
      data: {
        status: 'active',
        planId: payment.planId,
        trialEndsAt: null,
      },
    });

    // STEP 4: Generate invoice — IDEMPOTENT (check existing first)
    let invoice = await db.subscriptionInvoice.findUnique({ where: { paymentId } });
    if (!invoice) {
      // Get super admin info from platform settings
      const saContactSetting = await db.platformSetting.findUnique({ where: { key: 'SUPER_ADMIN_WHATSAPP' } });
      const saGstSetting = await db.platformSetting.findUnique({ where: { key: 'SUPER_ADMIN_GST' } });
      const taxRateSetting = await db.platformSetting.findUnique({ where: { key: 'DEFAULT_TAX_RATE_PERCENT' } });
      const taxRate = taxRateSetting ? parseInt(taxRateSetting.value) || 0 : 0;
      const taxAmount = Math.round((payment.finalAmountSnapshot * taxRate) / 100);
      const totalWithTax = payment.finalAmountSnapshot + taxAmount;

      // Generate unique invoice number: INV-YYYY-NNNNN
      const yearStr = now.getFullYear();
      const countThisYear = await db.subscriptionInvoice.count({
        where: { invoiceNumber: { startsWith: `INV-${yearStr}-` } },
      });
      const invoiceNumber = `INV-${yearStr}-${String(countThisYear + 1).padStart(5, '0')}`;

      // Get company info from tenant's business profile
      const businessProfile = await db.businessProfile.findUnique({ where: { tenantId: payment.tenantId } });
      const companyName = businessProfile?.businessName || payment.tenant.name;
      const companyGstSetting = await db.platformSetting.findUnique({ where: { key: `TENANT_GST_${payment.tenantId}` } });

      invoice = await db.subscriptionInvoice.create({
        data: {
          tenantId: payment.tenantId,
          paymentId,
          invoiceNumber,
          invoiceDate: now,
          companyName,
          companyAddress: businessProfile?.locations || '',
          companyContact: businessProfile ? businessProfile.businessName : '',
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
          superAdminName: ctx.session.name || 'Super Admin',
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
      await db.subscriptionPayment.update({
        where: { id: paymentId },
        data: { invoiceId: invoice.id },
      });
    }

    // STEP 5: Attempt WhatsApp delivery (outside transaction so failures don't roll back verification)
    let whatsappResult: { status: string; message: string } = { status: 'NOT_CONFIGURED', message: 'WhatsApp not configured' };
    try {
      whatsappResult = await deliverInvoiceViaWhatsApp(invoice.id, ctx);
    } catch (e: any) {
      whatsappResult = { status: 'FAILED', message: e.message };
    }

    // Audit
    try {
      await db.auditTrailEntry.create({
        data: {
          tenantId: payment.tenantId,
          userId: ctx.session.sub,
          action: 'payment_verified',
          entity: 'subscriptionPayment',
          entityId: paymentId,
          details: { invoiceId: invoice.id, invoiceNumber: invoice.invoiceNumber, whatsappStatus: whatsappResult.status },
          ip: req.headers.get('x-forwarded-for') || '',
          userAgent: req.headers.get('user-agent') || '',
          severity: 'critical',
        },
      });
    } catch {}

    return {
      ok: true,
      paymentId,
      status: 'VERIFIED',
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
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
