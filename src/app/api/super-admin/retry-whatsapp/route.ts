// Super Admin: retry WhatsApp delivery of an invoice
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { withSuperAdmin, type AuthContext } from '@/lib/api-helpers';
import { deliverInvoiceViaWhatsApp } from '@/lib/billing';
import { z } from 'zod';

const RETRY_SCHEMA = z.object({
  invoiceId: z.string(),
});

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  return withSuperAdmin(req, async (ctx: AuthContext) => {
    const body = await req.json().catch(() => ({}));
    const parsed = RETRY_SCHEMA.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'invalid_input' }, { status: 400 });
    }
    const { invoiceId } = parsed.data;

    const invoice = await db.subscriptionInvoice.findUnique({ where: { id: invoiceId } });
    if (!invoice) return NextResponse.json({ error: 'invoice_not_found' }, { status: 404 });

    // Re-attempt delivery (the lib reports honest status)
    const result = await deliverInvoiceViaWhatsApp(invoiceId, ctx);

    await db.auditTrailEntry.create({
      data: {
        tenantId: invoice.tenantId,
        userId: ctx.session.sub,
        action: 'whatsapp_retry',
        entity: 'subscriptionInvoice',
        entityId: invoiceId,
        details: { whatsappStatus: result.status },
        ip: req.headers.get('x-forwarded-for') || '',
        userAgent: req.headers.get('user-agent') || '',
      },
    });

    return { ok: true, whatsappStatus: result.status, message: result.message };
  });
}
