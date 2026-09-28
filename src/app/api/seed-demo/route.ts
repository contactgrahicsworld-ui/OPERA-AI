// OPERA AI — Seed demo data so the new tenant has realistic data immediately.
// Useful for first-run + agent-browser verification.
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { withTenant, quickAudit, type AuthContext } from '@/lib/api-helpers';
import { generateInsights } from '@/lib/ai-brain';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  return withTenant(req, async (ctx: AuthContext) => {
    // Only allow if the tenant has very little data (avoid spamming real data).
    const leadCount = await db.lead.count({ where: { tenantId: ctx.tenantId } });
    if (leadCount > 0) {
      return { error: 'tenant_has_data', count: leadCount };
    }

    const now = new Date();
    const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
    const fiveDaysAgo = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);
    const tenDaysAgo = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);
    const yesterday = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000);
    const tomorrow = new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000);
    const threeDaysAhead = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

    const profile = await db.businessProfile.findUnique({ where: { tenantId: ctx.tenantId! } });
    const businessName = profile?.businessName || 'Demo Business';
    const currency = profile?.currency || 'INR';
    const usesInventory = profile?.usesInventory;

    // Create demo leads (mix of statuses)
    const leadNames = [
      ['Aarav Sharma', 'aarav@example.com', '9876543210', 'Acme Corp', 'New', 'New', 50000, 'high'],
      ['Priya Patel', 'priya@example.com', '9876543211', 'Tech Solutions', 'Contacted', 'Contacted', 75000, 'medium'],
      ['Rohan Gupta', 'rohan@example.com', '9876543212', 'Globe Traders', 'Qualified', 'Qualified', 120000, 'high'],
      ['Ananya Iyer', 'ananya@example.com', '9876543213', 'Skyline Industries', 'New', 'New', 30000, 'low'],
      ['Vikram Reddy', 'vikram@example.com', '9876543214', 'Pioneer Logistics', 'Contacted', 'Contacted', 95000, 'medium'],
      ['Sneha Nair', 'sneha@example.com', '9876543215', '', 'New', 'New', 0, 'medium'],
      ['Karan Malhotra', 'karan@example.com', '9876543216', 'Zenith Group', 'Qualified', 'Qualified', 180000, 'high'],
      ['Meera Joshi', 'meera@example.com', '9876543217', 'Apex Traders', 'New', 'New', 0, 'low'],
    ] as const;

    const leadIds: string[] = [];
    for (const [name, email, phone, company, stage, status, value, priority] of leadNames) {
      const l = await db.lead.create({
        data: {
          tenantId: ctx.tenantId!,
          name, email, phone, company,
          source: ['referral', 'website', 'social', 'cold_call', 'manual'][Math.floor(Math.random() * 5)],
          status, stage,
          value: value as number,
          priority: priority as string,
          lastActivityAt: Math.random() > 0.5 ? tenDaysAgo : yesterday,
        },
      });
      leadIds.push(l.id);
    }

    // Demo customers
    const customers = [
      ['Customer One Pvt Ltd', 'cust1@example.com', '9000000001', 'business', 'active', 250000],
      ['Customer Two LLP', 'cust2@example.com', '9000000002', 'business', 'active', 180000],
      ['Customer Three', 'cust3@example.com', '9000000003', 'individual', 'inactive', 50000],
      ['Customer Four Co', 'cust4@example.com', '9000000004', 'business', 'active', 320000],
    ] as const;
    const customerIds: string[] = [];
    for (const [name, email, phone, type, status, totalValue] of customers) {
      const c = await db.customer.create({
        data: { tenantId: ctx.tenantId!, name, email, phone, type: type as string, status: status as string, totalValue: totalValue as number, lastOrderAt: status === 'inactive' ? tenDaysAgo : yesterday },
      });
      customerIds.push(c.id);
    }

    // Demo quotations (some stale)
    const staleQ = await db.quotation.create({
      data: {
        tenantId: ctx.tenantId!,
        number: 'Q-DEMO-001',
        leadId: leadIds[1],
        subject: 'Server maintenance contract',
        status: 'sent',
        totalAmount: 85000,
        currency,
        sentAt: fiveDaysAgo, // stale
        validTill: threeDaysAhead,
        ownerId: ctx.session.sub,
        items: JSON.stringify([{ name: 'Annual maintenance', qty: 1, price: 85000 }]),
      },
    });
    const freshQ = await db.quotation.create({
      data: {
        tenantId: ctx.tenantId!,
        number: 'Q-DEMO-002',
        leadId: leadIds[2],
        subject: 'Bulk software licenses',
        status: 'sent',
        totalAmount: 155000,
        currency,
        sentAt: yesterday,
        validTill: threeDaysAhead,
        ownerId: ctx.session.sub,
        items: JSON.stringify([{ name: 'Software license (annual)', qty: 5, price: 31000 }]),
      },
    });

    // Demo overdue invoice
    const inv = await db.invoice.create({
      data: {
        tenantId: ctx.tenantId!,
        number: 'INV-DEMO-001',
        customerId: customerIds[0],
        amount: 100000,
        taxAmount: 18000,
        totalAmount: 118000,
        currency,
        status: 'overdue',
        dueDate: twoDaysAgo,
      },
    });
    const inv2 = await db.invoice.create({
      data: {
        tenantId: ctx.tenantId!,
        number: 'INV-DEMO-002',
        customerId: customerIds[1],
        amount: 50000,
        taxAmount: 9000,
        totalAmount: 59000,
        currency,
        status: 'unpaid',
        dueDate: tomorrow,
      },
    });

    // Demo tasks (overdue + open)
    await db.task.create({
      data: {
        tenantId: ctx.tenantId!,
        title: 'Send proposal to Aarav Sharma',
        type: 'follow_up',
        status: 'open',
        priority: 'high',
        dueDate: yesterday,
        leadId: leadIds[0],
        assigneeId: ctx.session.sub,
        ownerId: ctx.session.sub,
      },
    });
    await db.task.create({
      data: {
        tenantId: ctx.tenantId!,
        title: 'Collect payment from Customer One',
        type: 'collection',
        status: 'open',
        priority: 'urgent',
        dueDate: twoDaysAgo,
        customerId: customerIds[0],
        assigneeId: ctx.session.sub,
        ownerId: ctx.session.sub,
      },
    });
    await db.task.create({
      data: {
        tenantId: ctx.tenantId!,
        title: 'Prepare demo for Karan Malhotra',
        type: 'general',
        status: 'open',
        priority: 'medium',
        dueDate: tomorrow,
        leadId: leadIds[6],
        assigneeId: ctx.session.sub,
        ownerId: ctx.session.sub,
      },
    });

    // Demo payments (this month)
    await db.payment.create({
      data: {
        tenantId: ctx.tenantId!,
        number: 'P-DEMO-001',
        customerId: customerIds[2],
        amount: 25000,
        currency,
        method: 'upi',
        status: 'received',
        paidAt: yesterday,
      },
    });
    await db.payment.create({
      data: {
        tenantId: ctx.tenantId!,
        number: 'P-DEMO-002',
        customerId: customerIds[3],
        amount: 75000,
        currency,
        method: 'bank',
        status: 'received',
        paidAt: twoDaysAgo,
      },
    });

    // Demo expenses
    await db.expense.create({
      data: {
        tenantId: ctx.tenantId!,
        category: 'office',
        description: 'Office supplies',
        amount: 5000,
        currency,
        paidAt: yesterday,
      },
    });

    // Demo products + stock (if inventory used)
    if (usesInventory) {
      const p1 = await db.product.create({
        data: {
          tenantId: ctx.tenantId!,
          name: 'Widget A',
          sku: 'WID-A-001',
          type: 'product',
          category: 'Widgets',
          price: 1500,
          cost: 900,
          unit: 'unit',
        },
      });
      const p2 = await db.product.create({
        data: {
          tenantId: ctx.tenantId!,
          name: 'Gadget B',
          sku: 'GDT-B-002',
          type: 'product',
          category: 'Gadgets',
          price: 3200,
          cost: 1800,
          unit: 'unit',
        },
      });
      // low stock for p1
      await db.stockItem.create({
        data: { tenantId: ctx.tenantId!, productId: p1.id, quantity: 2, reorderLevel: 10 },
      });
      await db.stockItem.create({
        data: { tenantId: ctx.tenantId!, productId: p2.id, quantity: 25, reorderLevel: 10 },
      });
    }

    // Generate AI insights based on the seed data
    await generateInsights(ctx.tenantId!);

    await quickAudit(ctx, 'seed_demo', 'tenant', ctx.tenantId!, `leads=${leadIds.length} customers=${customerIds.length}`);

    return {
      ok: true,
      counts: {
        leads: leadIds.length,
        customers: customerIds.length,
        quotations: 2,
        invoices: 2,
        tasks: 3,
        payments: 2,
      },
    };
  });
}
