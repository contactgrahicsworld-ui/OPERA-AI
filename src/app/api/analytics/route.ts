// OPERA AI — Analytics (trends, breakdowns)
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { withTenant, qp, type AuthContext } from '@/lib/api-helpers';
import { buildSnapshot } from '@/lib/ai-brain';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  return withTenant(req, async (ctx: AuthContext) => {
    const range = qp(req, 'range', '30d'); // 7d | 30d | 90d
    const days = range === '7d' ? 7 : range === '90d' ? 90 : 30;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const [payments, expenses, leads, quotations, snapshot, bySource] = await Promise.all([
      db.payment.findMany({ where: { tenantId: ctx.tenantId, paidAt: { gte: since } }, select: { amount: true, paidAt: true, method: true } }),
      db.expense.findMany({ where: { tenantId: ctx.tenantId, paidAt: { gte: since } }, select: { amount: true, paidAt: true, category: true } }),
      db.lead.findMany({ where: { tenantId: ctx.tenantId, createdAt: { gte: since } }, select: { status: true, stage: true, value: true, createdAt: true, source: true } }),
      db.quotation.findMany({ where: { tenantId: ctx.tenantId, createdAt: { gte: since } }, select: { status: true, totalAmount: true, createdAt: true } }),
      buildSnapshot(ctx.tenantId!),
      db.lead.groupBy({ by: ['source'], where: { tenantId: ctx.tenantId, createdAt: { gte: since } }, _count: true }),
    ]);

    // Daily time series
    const daily: Record<string, { revenue: number; expenses: number; leads: number }> = {};
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      const key = d.toISOString().slice(0, 10);
      daily[key] = { revenue: 0, expenses: 0, leads: 0 };
    }
    for (const p of payments) {
      const k = new Date(p.paidAt).toISOString().slice(0, 10);
      if (daily[k]) daily[k].revenue += p.amount;
    }
    for (const e of expenses) {
      const k = new Date(e.paidAt).toISOString().slice(0, 10);
      if (daily[k]) daily[k].expenses += e.amount;
    }
    for (const l of leads) {
      const k = new Date(l.createdAt).toISOString().slice(0, 10);
      if (daily[k]) daily[k].leads += 1;
    }

    return {
      range,
      days,
      totals: {
        revenue: payments.reduce((s, p) => s + p.amount, 0),
        expenses: expenses.reduce((s, e) => s + e.amount, 0),
        leads: leads.length,
        quotations: quotations.length,
        quotationValue: quotations.reduce((s, q) => s + q.totalAmount, 0),
      },
      snapshot,
      daily: Object.entries(daily).map(([date, v]) => ({ date, ...v })),
      leadsBySource: bySource,
      leadsByStage: snapshot.leadsByStage,
      quotationsByStatus: snapshot.quotationsByStatus,
    };
  });
}
