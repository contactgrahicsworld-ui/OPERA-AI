// Super Admin: list all subscription payments with filters
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { withSuperAdmin, qp, type AuthContext } from '@/lib/api-helpers';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  return withSuperAdmin(req, async (ctx: AuthContext) => {
    const status = qp(req, 'status', ''); // PENDING | VERIFIED | REJECTED | REFUNDED
    const limit = parseInt(qp(req, 'limit', '100'));

    const where: any = {};
    if (status) where.status = status;

    const items = await db.subscriptionPayment.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 500),
      include: {
        tenant: { select: { id: true, name: true, slug: true } },
        invoice: { select: { id: true, invoiceNumber: true, invoiceDate: true, pdfUrl: true, whatsappStatus: true } },
      },
    });

    const summary = {
      pending: await db.subscriptionPayment.count({ where: { status: 'PENDING' } }),
      verified: await db.subscriptionPayment.count({ where: { status: 'VERIFIED' } }),
      rejected: await db.subscriptionPayment.count({ where: { status: 'REJECTED' } }),
      refunded: await db.subscriptionPayment.count({ where: { status: 'REFUNDED' } }),
      totalAmountVerified: (await db.subscriptionPayment.aggregate({
        where: { status: 'VERIFIED' },
        _sum: { finalAmountSnapshot: true },
      }))._sum.finalAmountSnapshot || 0,
    };

    return { items, summary };
  });
}
