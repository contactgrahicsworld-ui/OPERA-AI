// Billing: initiate a payment for a plan — server-side computes final amount, customer cannot tamper
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { withTenant, quickAudit, type AuthContext } from '@/lib/api-helpers';
import { z } from 'zod';

const INITIATE_SCHEMA = z.object({
  planId: z.string(),
  billingCycle: z.enum(['monthly', 'yearly', 'custom']).default('yearly'),
  customDurationDays: z.number().int().min(7).max(730).optional(), // 7d min, 730d max (~2y)
  // Optional offerCode (must be verified server-side; cannot be tampered)
  offerCode: z.string().max(50).optional(),
});

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  return withTenant(req, async (ctx: AuthContext) => {
    const body = await req.json().catch(() => ({}));
    const parsed = INITIATE_SCHEMA.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'invalid_input', details: parsed.error.flatten() }, { status: 400 });
    }
    const { planId, billingCycle, customDurationDays, offerCode } = parsed.data;

    // Verify plan exists (server-side — customer cannot invent plan IDs)
    const plan = await db.plan.findUnique({ where: { id: planId } });
    if (!plan) {
      return NextResponse.json({ error: 'plan_not_found' }, { status: 404 });
    }

    // Compute duration + price SERVER-SIDE
    let durationDays: number;
    let basePrice: number;
    if (billingCycle === 'monthly') {
      durationDays = 30;
      basePrice = plan.priceMonthly;
    } else if (billingCycle === 'yearly') {
      durationDays = 365;
      basePrice = plan.priceYearly;
    } else {
      // custom
      if (!customDurationDays) {
        return NextResponse.json({ error: 'custom_duration_required' }, { status: 400 });
      }
      // Custom duration: prorate yearly price
      const dailyRate = plan.priceYearly > 0 ? plan.priceYearly / 365 : plan.priceMonthly * 12 / 365;
      basePrice = Math.round(dailyRate * customDurationDays);
      durationDays = customDurationDays;
    }

    // Apply offer code (server-side validation; offers come from PlatformSetting)
    let discountPaise = 0;
    if (offerCode) {
      const offerSetting = await db.platformSetting.findUnique({ where: { key: `OFFER_${offerCode.toUpperCase()}` } });
      if (offerSetting && offerSetting.value) {
        try {
          const offer = JSON.parse(offerSetting.value);
          // Offer: { type: 'percent' | 'flat', value: number, validTill: ISO, maxUses?: number }
          if (offer.validTill && new Date(offer.validTill) > new Date()) {
            if (offer.type === 'percent') {
              discountPaise = Math.round((basePrice * offer.value) / 100);
            } else if (offer.type === 'flat') {
              discountPaise = Math.min(offer.value, basePrice);
            }
          }
        } catch {}
      }
    }

    const finalAmount = Math.max(0, basePrice - discountPaise);

    // Get current UPI receiver
    const upiSetting = await db.platformSetting.findUnique({ where: { key: 'UPI_RECEIVER' } });
    const upiReceiver = upiSetting?.value || '9301056006';

    // Find tenant info
    const tenant = await db.tenant.findUnique({ where: { id: ctx.tenantId! } });
    if (!tenant) {
      return NextResponse.json({ error: 'tenant_not_found' }, { status: 404 });
    }

    // Create SubscriptionPayment record (status PENDING — no UTR yet)
    const payment = await db.subscriptionPayment.create({
      data: {
        tenantId: ctx.tenantId!,
        userId: ctx.session.sub,
        planId: plan.id,
        planNameSnapshot: plan.name,
        priceSnapshot: basePrice,
        discountSnapshot: discountPaise,
        finalAmountSnapshot: finalAmount,
        durationDaysSnapshot: durationDays,
        billingCycleSnapshot: billingCycle,
        upiReceiverSnapshot: upiReceiver,
        status: 'PENDING',
        auditTrail: JSON.stringify([{ action: 'initiated', by: ctx.session.sub, at: new Date().toISOString(), ip: req.headers.get('x-forwarded-for') || '' }]),
      },
    });

    await quickAudit(ctx, 'billing_initiate', 'subscriptionPayment', payment.id, `plan=${plan.name} amount=${finalAmount}`);

    // Build UPI deep link (server-controlled, customer can't tamper receiver)
    const upiDeepLink = `upi://pay?pa=${upiReceiver}&pn=OPERA AI&am=${(finalAmount / 100).toFixed(2)}&cu=INR&tn=OPERA-${payment.id.slice(-8)}`;

    return {
      ok: true,
      paymentId: payment.id,
      plan: plan.name,
      basePrice,
      discount: discountPaise,
      finalAmount,
      durationDays,
      billingCycle,
      upiReceiver,
      upiReceiverName: 'OPERA AI Operations',
      upiDeepLink,
      upiQrData: upiDeepLink, // for QR code rendering on client
      nextStep: 'Pay to the UPI ID above, then submit UTR via /api/billing/submit-utr',
    };
  });
}
