// Billing: list available plans + show UPI receiver (server-controlled, customer can't modify)
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { withTenant, type AuthContext } from '@/lib/api-helpers';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  return withTenant(req, async (ctx: AuthContext) => {
    const [plans, upiSetting, upiNameSetting, currentSub, currentTenant] = await Promise.all([
      db.plan.findMany({ orderBy: { priceMonthly: 'asc' } }),
      db.platformSetting.findUnique({ where: { key: 'UPI_RECEIVER' } }),
      db.platformSetting.findUnique({ where: { key: 'UPI_RECEIVER_NAME' } }),
      db.subscription.findFirst({
        where: { tenantId: ctx.tenantId! },
        include: { plan: true },
        orderBy: { createdAt: 'desc' },
      }),
      db.tenant.findUnique({ where: { id: ctx.tenantId! } }),
    ]);

    // Recent payments for this tenant
    const recentPayments = await db.subscriptionPayment.findMany({
      where: { tenantId: ctx.tenantId },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: { invoice: true },
    });

    // Invoices for this tenant
    const myInvoices = await db.subscriptionInvoice.findMany({
      where: { tenantId: ctx.tenantId },
      orderBy: { invoiceDate: 'desc' },
      take: 20,
    });

    return {
      plans: plans.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        priceMonthly: p.priceMonthly,
        priceYearly: p.priceYearly,
        trialDays: p.trialDays,
        maxUsers: p.maxUsers,
        maxAiCalls: p.maxAiCalls,
        maxStorageMb: p.maxStorageMb,
        featuresCsv: p.featuresCsv,
        isDefault: p.isDefault,
      })),
      upiReceiver: upiSetting?.value || 'NOT_CONFIGURED',
      upiReceiverName: upiNameSetting?.value || 'OPERA AI Operations',
      currentSubscription: currentSub ? {
        status: currentSub.status,
        plan: currentSub.plan.name,
        startedAt: currentSub.startedAt,
        endsAt: currentSub.endsAt,
        amount: currentSub.amount,
        billingCycle: currentSub.billingCycle,
      } : null,
      tenantStatus: currentTenant?.status,
      trialEndsAt: currentTenant?.trialEndsAt,
      recentPayments: recentPayments.map((p) => ({
        id: p.id,
        planNameSnapshot: p.planNameSnapshot,
        finalAmountSnapshot: p.finalAmountSnapshot,
        status: p.status,
        utr: p.utr,
        utrSubmittedAt: p.utrSubmittedAt,
        verifiedAt: p.verifiedAt,
        rejectionReason: p.rejectionReason,
        whatsappStatus: p.whatsappStatus,
        invoiceNumber: p.invoice?.invoiceNumber,
        createdAt: p.createdAt,
      })),
      myInvoices: myInvoices.map((inv) => ({
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        invoiceDate: inv.invoiceDate,
        planName: inv.planName,
        durationDays: inv.durationDays,
        finalAmount: inv.finalAmount,
        totalWithTax: inv.totalWithTax,
        startDate: inv.startDate,
        expiryDate: inv.expiryDate,
        utr: inv.utr,
        whatsappStatus: inv.whatsappStatus,
      })),
    };
  });
}
