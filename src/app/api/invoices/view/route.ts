// View invoice (HTML — accessible by tenant who owns it OR super admin)
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/session';
import { requireSuperAdmin } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const invoiceId = url.searchParams.get('id') || '';

  const session = await getCurrentUser();
  if (!session) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  if (!session.user.tenantId && !session.user.isSuperAdmin) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const invoice = await db.subscriptionInvoice.findUnique({
    where: { id: invoiceId },
    include: { payment: { include: { tenant: true } } },
  });
  if (!invoice) {
    return NextResponse.json({ error: 'invoice_not_found' }, { status: 404 });
  }

  // Tenant isolation: super admin can see any; tenant users can only see their own
  if (!session.user.isSuperAdmin && invoice.tenantId !== session.user.tenantId) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  // Render as HTML invoice
  const html = renderInvoiceHTML(invoice);
  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

function formatINR(rupees: number): string {
  return (rupees || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

function formatDate(d: Date | string | null | undefined): string {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: '2-digit' });
  } catch {
    return '—';
  }
}

function renderInvoiceHTML(inv: any): string {
  const taxRow = inv.taxAmount > 0 ? `
    <tr><td>Tax (${inv.taxRate}%):</td><td>₹${formatINR(inv.taxAmount / 100)}</td></tr>
    <tr class="total"><td>Total with Tax:</td><td>₹${formatINR(inv.totalWithTax / 100)}</td></tr>` : `
    <tr class="total"><td>Total Payable:</td><td>₹${formatINR(inv.finalAmount / 100)}</td></tr>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Invoice ${inv.invoiceNumber} — OPERA AI</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: 'Segoe UI', system-ui, sans-serif; color: #1f2937; background: #f3f4f6; margin: 0; padding: 20px; }
  .invoice { max-width: 800px; margin: 0 auto; background: #fff; padding: 40px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #0d9488; padding-bottom: 20px; margin-bottom: 30px; }
  .brand { font-size: 32px; font-weight: bold; color: #0d9488; }
  .brand-sub { font-size: 12px; color: #6b7280; margin-top: 4px; }
  .invoice-meta { text-align: right; }
  .invoice-num { font-size: 24px; font-weight: bold; color: #1f2937; }
  .invoice-date { color: #6b7280; font-size: 14px; margin-top: 4px; }
  .badges { display: flex; gap: 8px; margin-top: 8px; justify-content: flex-end; }
  .badge { padding: 4px 10px; border-radius: 4px; font-size: 11px; font-weight: 600; }
  .badge-paid { background: #d1fae5; color: #065f46; }
  .badge-wa { background: #f3f4f6; color: #4b5563; font-size: 10px; }
  .parties { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-bottom: 30px; }
  .party h4 { color: #0d9488; margin: 0 0 8px; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; }
  .party p { margin: 2px 0; font-size: 14px; }
  .plan { background: #f9fafb; padding: 16px; border-radius: 6px; margin-bottom: 20px; }
  .plan-name { font-size: 18px; font-weight: 600; color: #0d9488; }
  .plan-dur { color: #6b7280; margin-top: 4px; }
  table { width: 100%; border-collapse: collapse; margin-top: 20px; }
  td { padding: 10px 0; border-bottom: 1px solid #e5e7eb; font-size: 14px; }
  td:first-child { color: #6b7280; }
  td:last-child { text-align: right; font-weight: 500; }
  tr.total td { font-weight: 700; color: #0d9488; font-size: 16px; border-bottom: 2px solid #0d9488; }
  .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 11px; color: #9ca3af; text-align: center; }
  @media print { body { background: #fff; padding: 0; } .invoice { box-shadow: none; } }
</style>
</head>
<body>
  <div class="invoice">
    <div class="header">
      <div>
        <div class="brand">OPERA AI</div>
        <div class="brand-sub">AI Business Operator · ${inv.superAdminBusinessName}</div>
        ${inv.superAdminContact ? `<div class="brand-sub">Contact: ${inv.superAdminContact}</div>` : ''}
        ${inv.superAdminGst ? `<div class="brand-sub">GST: ${inv.superAdminGst}</div>` : ''}
      </div>
      <div class="invoice-meta">
        <div class="invoice-num">${inv.invoiceNumber}</div>
        <div class="invoice-date">Issued: ${formatDate(inv.invoiceDate)}</div>
        <div class="badges">
          <span class="badge badge-paid">PAID · ${inv.paymentMethod}</span>
          <span class="badge badge-wa">WhatsApp: ${inv.whatsappStatus}</span>
        </div>
      </div>
    </div>
    <div class="parties">
      <div class="party">
        <h4>Billed To</h4>
        <p style="font-weight: 600;">${inv.companyName}</p>
        ${inv.companyAddress ? `<p>${inv.companyAddress}</p>` : ''}
        ${inv.companyContact ? `<p>${inv.companyContact}</p>` : ''}
        ${inv.companyGst ? `<p>GST: ${inv.companyGst}</p>` : ''}
      </div>
      <div class="party">
        <h4>Subscription Period</h4>
        <p>Start: <strong>${formatDate(inv.startDate)}</strong></p>
        <p>Expiry: <strong>${formatDate(inv.expiryDate)}</strong></p>
        <p>Duration: <strong>${inv.durationDays} days</strong></p>
      </div>
    </div>
    <div class="plan">
      <div class="plan-name">Plan: ${inv.planName}</div>
      <div class="plan-dur">UTR: ${inv.utr} · Payment Date: ${formatDate(inv.paymentDate)}</div>
    </div>
    <table>
      <tr><td>Original Amount:</td><td>₹${formatINR(inv.originalAmount / 100)}</td></tr>
      ${inv.discountAmount > 0 ? `<tr><td>Discount:</td><td>− ₹${formatINR(inv.discountAmount / 100)}</td></tr>` : ''}
      <tr><td>Subtotal:</td><td>₹${formatINR(inv.finalAmount / 100)}</td></tr>
      ${taxRow}
    </table>
    <div class="footer">
      This is a computer-generated invoice from OPERA AI. No signature required.<br>
      For queries, contact your OPERA AI Super Admin. WhatsApp delivery status: ${inv.whatsappStatus}.
    </div>
  </div>
</body>
</html>`;
}
