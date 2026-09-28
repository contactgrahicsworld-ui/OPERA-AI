// OPERA AI — Billing lib: invoice generation helpers + WhatsApp delivery abstraction
// Server-side only. Never fabricate invoice data or WhatsApp delivery status.

import { db } from './db';
import type { AuthContext } from './auth';

// ============================================================
// Invoice generation — idempotent (the verify-utr route calls this in a transaction)
// ============================================================
export async function generateInvoice(paymentId: string, ctx: AuthContext) {
  // Check if invoice already exists — idempotent
  const existing = await db.subscriptionInvoice.findUnique({ where: { paymentId } });
  if (existing) return existing;

  // Otherwise we expect the verify-utr route to create it in its transaction.
  // This function is a no-op helper that returns the (potentially just-created) invoice.
  return await db.subscriptionInvoice.findUnique({ where: { paymentId } });
}

// ============================================================
// WhatsApp delivery — honest status reporting
// Statuses: NOT_CONFIGURED | QUEUED | SENDING | SENT | DELIVERED | FAILED
// ============================================================
export async function deliverInvoiceViaWhatsApp(invoiceId: string, ctx: AuthContext): Promise<{ status: string; message: string }> {
  const invoice = await db.subscriptionInvoice.findUnique({
    where: { id: invoiceId },
    include: { payment: { include: { tenant: true } } },
  });
  if (!invoice) {
    return { status: 'FAILED', message: 'Invoice not found' };
  }

  // Get customer's registered WhatsApp (tenant's business profile contact)
  const businessProfile = await db.businessProfile.findUnique({ where: { tenantId: invoice.tenantId } });
  if (!businessProfile) {
    // Try tenant's primary user phone
    const primaryUser = await db.user.findFirst({ where: { tenantId: invoice.tenantId, role: 'OWNER' } });
    if (!primaryUser) {
      await markWhatsAppStatus(invoiceId, 'FAILED', 'No business profile / no owner phone');
      return { status: 'FAILED', message: 'No business profile / no owner phone' };
    }
  }

  // Get WhatsApp provider config
  const providerSetting = await db.platformSetting.findUnique({ where: { key: 'WHATSAPP_PROVIDER' } });
  const provider = providerSetting?.value || 'none';

  if (provider === 'none' || !provider) {
    // HONEST: WhatsApp is NOT_CONFIGURED. Do NOT pretend SENT/DELIVERED.
    await markWhatsAppStatus(invoiceId, 'NOT_CONFIGURED', 'WhatsApp provider not configured. Set WHATSAPP_PROVIDER + WHATSAPP_API_TOKEN platform settings.');
    return { status: 'NOT_CONFIGURED', message: 'WhatsApp provider not configured. Subscription is still ACTIVE; invoice is generated. Configure WhatsApp provider to enable delivery.' };
  }

  // For real provider integration, call the actual API here (Twilio WhatsApp / Meta Cloud API / Gupshup / Interakt)
  // and only mark SENT when the provider returns 200 + message ID.
  // For now: we honour the spec by NOT fabricating SENT/DELIVERED.
  await markWhatsAppStatus(invoiceId, 'NOT_CONFIGURED', `Provider '${provider}' not yet integrated in this build. Implement the actual API call in /lib/billing.ts:deliverInvoiceViaWhatsApp.`);
  return { status: 'NOT_CONFIGURED', message: `Provider '${provider}' integration is CONFIGURATION REQUIRED. Implement the actual provider call.` };
}

async function markWhatsAppStatus(invoiceId: string, status: string, errorMessage?: string) {
  const updates: any = {
    whatsappStatus: status,
  };
  if (status === 'SENT') updates.whatsappSentAt = new Date();
  if (status === 'DELIVERED') updates.whatsappDeliveredAt = new Date();

  await db.subscriptionInvoice.update({ where: { id: invoiceId }, data: updates });

  // Also update the linked payment
  const invoice = await db.subscriptionInvoice.findUnique({ where: { id: invoiceId } });
  if (invoice?.paymentId) {
    const pUpdates: any = { whatsappStatus: status, whatsappAttempts: { increment: 1 } };
    if (errorMessage && (status === 'FAILED' || status === 'NOT_CONFIGURED')) pUpdates.whatsappLastError = errorMessage;
    await db.subscriptionPayment.update({ where: { id: invoice.paymentId }, data: pUpdates });
  }
}

// ============================================================
// UPI receiver management (super admin controls)
// ============================================================
export async function getUpiReceiver(): Promise<string> {
  const setting = await db.platformSetting.findUnique({ where: { key: 'UPI_RECEIVER' } });
  return setting?.value || '9301056006';
}

export async function setUpiReceiver(newReceiver: string, ctx: AuthContext): Promise<void> {
  // Validate: Indian UPI ID format (name@bank or 10-digit mobile number)
  const clean = newReceiver.trim();
  if (!/^[a-zA-Z0-9.\-_]{2,50}@[a-zA-Z0-9.\-_]{2,30}$/.test(clean) && !/^[0-9]{10}$/.test(clean)) {
    throw new Error('Invalid UPI ID format (must be name@bank or 10-digit mobile)');
  }
  await db.platformSetting.upsert({
    where: { key: 'UPI_RECEIVER' },
    create: { key: 'UPI_RECEIVER', value: clean, description: 'Default UPI receiver for subscription payments' },
    update: { value: clean, updatedById: ctx.session.sub, updatedAt: new Date() },
  });

  // Audit
  await db.auditTrailEntry.create({
    data: {
      tenantId: null,
      userId: ctx.session.sub,
      action: 'upi_receiver_changed',
      entity: 'PlatformSetting',
      entityId: 'UPI_RECEIVER',
      details: { newReceiver: clean },
      severity: 'critical',
    },
  });
}

// ============================================================
// Helpers
// ============================================================
export function paiseToINR(paise: number): number {
  return Math.round((paise || 0) / 100);
}

export function formatINR(rupees: number): string {
  return (rupees || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });
}
