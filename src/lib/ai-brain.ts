// OPERA AI — AI Business Brain
// Server-side. Analyzes REAL tenant data and generates evidence-backed insights.
// NEVER invents business facts.

import { db } from './db';
import { callAI, assertFacts, buildBusinessContext } from './ai';
import { getBusinessDNA } from './business-dna';
import { z } from 'zod';

export interface InsightInput {
  tenantId: string;
}

// ============================================================
// Evidence-gathering queries (no AI involvement — pure SQL facts)
// ============================================================

export interface BusinessSnapshot {
  // Leads
  leadsTotal: number;
  leadsByStage: Record<string, number>;
  leadsNewToday: number;
  leadsNeedingFollowup: number;
  // Quotations
  quotationsTotal: number;
  quotationsByStatus: Record<string, number>;
  quotationsAmountWaiting: number;
  quotationsStaleCount: number;
  quotationsStaleValue: number;
  // Customers
  customersTotal: number;
  customersActive: number;
  customersInactive: number;
  // Payments
  paymentsOverdueCount: number;
  paymentsOverdueAmount: number;
  paymentsTotalThisMonth: number;
  paymentsTotalLastMonth: number;
  // Tasks
  tasksOpen: number;
  tasksOverdue: number;
  // Inventory
  lowStockCount: number;
  // Team activity
  staffActivitiesPending: number;
  // Money
  expensesThisMonth: number;
  receivablesOutstanding: number;
  // Recent records (top items)
  topOverduePayments: any[];
  topStaleQuotations: any[];
  topLeadsNeedingFollowup: any[];
  topLowStockProducts: any[];
  topOverdueTasks: any[];
}

export async function buildSnapshot(tenantId: string): Promise<BusinessSnapshot> {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

  // Leads
  const leads = await db.lead.findMany({ where: { tenantId }, select: { id: true, status: true, stage: true, lastActivityAt: true, ownerId: true, name: true, email: true, phone: true, value: true } });
  const leadsByStage: Record<string, number> = {};
  for (const l of leads) {
    const k = l.stage || l.status || 'New';
    leadsByStage[k] = (leadsByStage[k] || 0) + 1;
  }
  const leadsNeedingFollowup = leads.filter((l) => !l.lastActivityAt || new Date(l.lastActivityAt) < sevenDaysAgo).length;
  const leadsNewToday = leads.filter((l) => l.status === 'New').length;

  // Quotations
  const quotations = await db.quotation.findMany({ where: { tenantId }, select: { id: true, number: true, status: true, totalAmount: true, sentAt: true, subject: true, leadId: true } });
  const quotationsByStatus: Record<string, number> = {};
  let quotationsAmountWaiting = 0;
  let quotationsStaleCount = 0;
  let quotationsStaleValue = 0;
  for (const q of quotations) {
    quotationsByStatus[q.status] = (quotationsByStatus[q.status] || 0) + 1;
    if (q.status === 'sent') {
      quotationsAmountWaiting += q.totalAmount;
      if (q.sentAt && new Date(q.sentAt) < threeDaysAgo) {
        quotationsStaleCount++;
        quotationsStaleValue += q.totalAmount;
      }
    }
  }
  const topStaleQuotations = quotations
    .filter((q) => q.status === 'sent' && q.sentAt && new Date(q.sentAt) < threeDaysAgo)
    .slice(0, 10);

  // Customers
  const customers = await db.customer.findMany({ where: { tenantId }, select: { id: true, status: true, lastOrderAt: true } });
  const customersActive = customers.filter((c) => c.status === 'active').length;
  const customersInactive = customers.filter((c) => c.status === 'inactive' || (c.lastOrderAt && new Date(c.lastOrderAt) < thirtyDaysAgo)).length;

  // Payments (overdue = unpaid invoices past due)
  const overdueInvoices = await db.invoice.findMany({
    where: { tenantId, status: { in: ['unpaid', 'partial', 'overdue'] }, dueDate: { lt: today } },
    include: { customer: true },
  });
  const paymentsOverdueCount = overdueInvoices.length;
  const paymentsOverdueAmount = overdueInvoices.reduce((s, i) => s + (i.totalAmount - 0), 0);
  const topOverduePayments = overdueInvoices.slice(0, 10).map((i) => ({
    id: i.id,
    number: i.number,
    amount: i.totalAmount,
    dueDate: i.dueDate,
    customer: i.customer?.name || '',
    customerId: i.customerId,
  }));

  const paymentsThisMonth = await db.payment.findMany({ where: { tenantId, paidAt: { gte: monthStart, lte: now } } });
  const paymentsLastMonth = await db.payment.findMany({ where: { tenantId, paidAt: { gte: lastMonthStart, lte: lastMonthEnd } } });
  const paymentsTotalThisMonth = paymentsThisMonth.reduce((s, p) => s + p.amount, 0);
  const paymentsTotalLastMonth = paymentsLastMonth.reduce((s, p) => s + p.amount, 0);

  // Tasks
  const tasksOpen = await db.task.count({ where: { tenantId, status: 'open' } });
  const tasksOverdue = await db.task.count({ where: { tenantId, status: 'open', dueDate: { lt: today } } });
  const topOverdueTasks = await db.task.findMany({
    where: { tenantId, status: 'open', dueDate: { lt: today } },
    take: 10,
    orderBy: { dueDate: 'asc' },
  });

  // Inventory
  const lowStockItems = await db.stockItem.findMany({
    where: { tenantId, quantity: { lte: db.stockItem.fields.reorderLevel } },
    include: { product: true, warehouse: true },
  });
  // SQLite doesn't support `lte: field` — fetch all and filter:
  const allStock = await db.stockItem.findMany({ where: { tenantId }, include: { product: true, warehouse: true } });
  const lowStock = allStock.filter((s) => s.quantity <= s.reorderLevel);
  const topLowStockProducts = lowStock.slice(0, 10).map((s) => ({
    id: s.id,
    product: s.product?.name || '',
    sku: s.product?.sku || '',
    quantity: s.quantity,
    reorderLevel: s.reorderLevel,
    warehouse: s.warehouse?.name || 'default',
  }));

  // Staff activities pending
  const staffActivitiesPending = await db.task.count({
    where: { tenantId, status: 'open', assigneeId: { not: null } },
  });

  // Money
  const expensesThisMonth = await db.expense.aggregate({
    where: { tenantId, paidAt: { gte: monthStart, lte: now } },
    _sum: { amount: true },
  });
  const receivables = await db.invoice.aggregate({
    where: { tenantId, status: { in: ['unpaid', 'partial', 'overdue'] } },
    _sum: { totalAmount: true },
  });

  // Leads needing follow-up (top 10)
  const topLeadsNeedingFollowup = leads
    .filter((l) => !l.lastActivityAt || new Date(l.lastActivityAt) < sevenDaysAgo)
    .slice(0, 10);

  return {
    leadsTotal: leads.length,
    leadsByStage,
    leadsNewToday,
    leadsNeedingFollowup,
    quotationsTotal: quotations.length,
    quotationsByStatus,
    quotationsAmountWaiting,
    quotationsStaleCount,
    quotationsStaleValue,
    customersTotal: customers.length,
    customersActive,
    customersInactive,
    paymentsOverdueCount,
    paymentsOverdueAmount,
    paymentsTotalThisMonth,
    paymentsTotalLastMonth,
    tasksOpen,
    tasksOverdue,
    lowStockCount: lowStock.length,
    staffActivitiesPending,
    expensesThisMonth: expensesThisMonth._sum.amount || 0,
    receivablesOutstanding: receivables._sum.totalAmount || 0,
    topOverduePayments,
    topStaleQuotations: topStaleQuotations.map((q) => ({
      id: q.id,
      number: q.number,
      amount: q.totalAmount,
      sentAt: q.sentAt,
      subject: q.subject,
      leadId: q.leadId,
    })),
    topLeadsNeedingFollowup: topLeadsNeedingFollowup.map((l) => ({
      id: l.id,
      name: l.name,
      email: l.email,
      phone: l.phone,
      stage: l.stage,
      value: l.value,
      lastActivityAt: l.lastActivityAt,
      ownerId: l.ownerId,
    })),
    topLowStockProducts,
    topOverdueTasks: topOverdueTasks.map((t) => ({
      id: t.id,
      title: t.title,
      dueDate: t.dueDate,
      priority: t.priority,
      assigneeId: t.assigneeId,
    })),
  };
}

// ============================================================
// Insight + Action generation (rule-based + AI-augmented)
// ============================================================

const INSIGHT_SCHEMA = z.object({
  insights: z.array(z.object({
    title: z.string(),
    type: z.enum(['risk', 'opportunity', 'anomaly', 'trend', 'recommendation']),
    priority: z.enum(['low', 'medium', 'high', 'urgent']),
    evidence: z.array(z.string()),
    sourceRefs: z.array(z.object({
      entity: z.string(),
      id: z.string(),
    })).default([]),
    recommendedAction: z.string(),
    confidence: z.number().min(0).max(100),
    uncertainty: z.string().default(''),
    category: z.enum(['sales', 'money', 'inventory', 'customer', 'operations', 'team']),
    actionTitle: z.string(),
    actionDescription: z.string(),
    actionCategory: z.enum(['follow_up', 'collection', 'restock', 'reengage', 'notify', 'custom']),
    requiresApproval: z.boolean().default(true),
    riskLevel: z.enum(['low', 'medium', 'high', 'critical']).default('low'),
  })),
});

export async function generateInsights(tenantId: string) {
  const [snapshot, dna] = await Promise.all([
    buildSnapshot(tenantId),
    getBusinessDNA(tenantId),
  ]);

  // Rule-based critical insights (no AI dependency for the basics).
  const insights: any[] = [];
  const actions: any[] = [];

  if (snapshot.leadsNeedingFollowup > 0) {
    insights.push({
      title: `${snapshot.leadsNeedingFollowup} leads need follow-up`,
      type: 'risk',
      priority: 'high',
      evidence: [`Leads with no activity in last 7 days: ${snapshot.leadsNeedingFollowup}`],
      sourceRefs: snapshot.topLeadsNeedingFollowup.slice(0, 5).map((l) => ({ entity: 'lead', id: l.id })),
      recommendedAction: 'Create follow-up tasks for top stale leads and notify owners.',
      confidence: 100,
      uncertainty: '',
      category: 'sales',
      actionTitle: `Follow up with ${Math.min(8, snapshot.leadsNeedingFollowup)} stale leads`,
      actionDescription: `Create follow-up tasks for the highest-value stale leads.`,
      actionCategory: 'follow_up',
      requiresApproval: true,
      riskLevel: 'low',
    });
  }

  if (snapshot.quotationsAmountWaiting > 0) {
    insights.push({
      title: `₹${formatINR(snapshot.quotationsAmountWaiting)} in quotations awaiting response`,
      type: 'risk',
      priority: snapshot.quotationsStaleCount > 0 ? 'urgent' : 'medium',
      evidence: [
        `Total quotations in 'sent' status: ₹${formatINR(snapshot.quotationsAmountWaiting)}`,
        `Stale (>3 days): ${snapshot.quotationsStaleCount} quotations worth ₹${formatINR(snapshot.quotationsStaleValue)}`,
      ],
      sourceRefs: snapshot.topStaleQuotations.slice(0, 5).map((q) => ({ entity: 'quotation', id: q.id })),
      recommendedAction: 'Send reminder or schedule a follow-up call for stale quotations.',
      confidence: 100,
      uncertainty: '',
      category: 'sales',
      actionTitle: `Chase ${Math.min(5, snapshot.quotationsStaleCount)} stale quotations`,
      actionDescription: `Create follow-up tasks for stale quotations.`,
      actionCategory: 'follow_up',
      requiresApproval: true,
      riskLevel: 'low',
    });
  }

  if (snapshot.paymentsOverdueCount > 0) {
    insights.push({
      title: `${snapshot.paymentsOverdueCount} customer payments are overdue`,
      type: 'risk',
      priority: 'high',
      evidence: [
        `Overdue invoices: ${snapshot.paymentsOverdueCount}`,
        `Total overdue amount: ₹${formatINR(snapshot.paymentsOverdueAmount)}`,
      ],
      sourceRefs: snapshot.topOverduePayments.slice(0, 5).map((p) => ({ entity: 'invoice', id: p.id })),
      recommendedAction: 'Create collection tasks and notify the responsible salesperson.',
      confidence: 100,
      uncertainty: '',
      category: 'money',
      actionTitle: `Open collection tasks for ${Math.min(5, snapshot.paymentsOverdueCount)} overdue payments`,
      actionDescription: `Generate collection tasks for highest-value overdue invoices.`,
      actionCategory: 'collection',
      requiresApproval: true,
      riskLevel: 'medium',
    });
  }

  if (snapshot.tasksOverdue > 0) {
    insights.push({
      title: `${snapshot.tasksOverdue} tasks are overdue`,
      type: 'risk',
      priority: 'medium',
      evidence: [`Open tasks past due date: ${snapshot.tasksOverdue}`],
      sourceRefs: snapshot.topOverdueTasks.slice(0, 5).map((t) => ({ entity: 'task', id: t.id })),
      recommendedAction: 'Reassign or escalate overdue tasks.',
      confidence: 100,
      uncertainty: '',
      category: 'operations',
      actionTitle: `Review ${Math.min(5, snapshot.tasksOverdue)} overdue tasks`,
      actionDescription: `Notify assignees and owners of overdue tasks.`,
      actionCategory: 'notify',
      requiresApproval: true,
      riskLevel: 'low',
    });
  }

  if (snapshot.lowStockCount > 0) {
    insights.push({
      title: `${snapshot.lowStockCount} products are below stock threshold`,
      type: 'risk',
      priority: 'medium',
      evidence: snapshot.topLowStockProducts.slice(0, 5).map((p) => `${p.product} (${p.sku}): ${p.quantity} ≤ reorder ${p.reorderLevel}`),
      sourceRefs: snapshot.topLowStockProducts.slice(0, 5).map((p) => ({ entity: 'stockItem', id: p.id })),
      recommendedAction: 'Create purchase recommendation for affected SKUs.',
      confidence: 100,
      uncertainty: '',
      category: 'inventory',
      actionTitle: `Generate purchase recommendation for ${Math.min(5, snapshot.lowStockCount)} low-stock SKUs`,
      actionDescription: `Draft purchase orders to replenish stock below reorder level.`,
      actionCategory: 'restock',
      requiresApproval: true,
      riskLevel: 'low',
    });
  }

  if (snapshot.customersInactive > 0) {
    insights.push({
      title: `${snapshot.customersInactive} customers appear inactive`,
      type: 'opportunity',
      priority: 'medium',
      evidence: [`Customers with no order in 30 days: ${snapshot.customersInactive}`],
      sourceRefs: [],
      recommendedAction: 'AI suggests creating re-engagement outreach for top inactive customers.',
      confidence: 70,
      uncertainty: 'Inactivity threshold is configurable; refine via Business DNA settings.',
      category: 'customer',
      actionTitle: `Draft re-engagement plan for inactive customers`,
      actionDescription: `Generate a list of inactive customers and a re-engagement script.`,
      actionCategory: 'reengage',
      requiresApproval: true,
      riskLevel: 'low',
    });
  }

  // Month-over-month comparison
  const momDelta = snapshot.paymentsTotalLastMonth > 0
    ? ((snapshot.paymentsTotalThisMonth - snapshot.paymentsTotalLastMonth) / snapshot.paymentsTotalLastMonth) * 100
    : 0;
  if (Math.abs(momDelta) > 5) {
    insights.push({
      title: `Revenue ${momDelta > 0 ? 'increased' : 'decreased'} ${Math.abs(momDelta).toFixed(1)}% vs last month`,
      type: 'trend',
      priority: momDelta < -10 ? 'urgent' : momDelta < 0 ? 'medium' : 'low',
      evidence: [
        `This month's payments: ₹${formatINR(snapshot.paymentsTotalThisMonth)}`,
        `Last month's payments: ₹${formatINR(snapshot.paymentsTotalLastMonth)}`,
        `Change: ${momDelta.toFixed(1)}%`,
      ],
      sourceRefs: [],
      recommendedAction: momDelta < 0
        ? 'Investigate the revenue decline. Review lost deals, slower collection, or reduced lead flow.'
        : 'Maintain momentum. Review what worked this month.',
      confidence: 100,
      uncertainty: 'Comparison only reflects recorded payments, not billed revenue.',
      category: 'money',
      actionTitle: 'Compare this month with last month',
      actionDescription: 'Open the analytics comparison view.',
      actionCategory: 'notify',
      requiresApproval: false,
      riskLevel: 'low',
    });
  }

  // AI-augmented deeper analysis (optional, fails gracefully)
  if (dna) {
    const aiRes = await callAI({
      prompt: `${assertFacts('Analyze this business snapshot and produce 0-2 additional evidence-backed insights.')} Business context: ${buildBusinessContext(dna, null)}\n\nSnapshot JSON:\n${JSON.stringify(snapshot, null, 2)}\n\nReturn only NEW insights not covered above (i.e., skip leads-needing-followup, quotations-waiting, payments-overdue, overdue-tasks, low-stock, customer-inactive, month-over-month-revenue).`,
      systemPrompt: 'You are an expert business operations analyst. NEVER invent facts. Only return insights supported by the provided snapshot JSON. If no additional insights are warranted, return { insights: [] }.',
      outputSchema: INSIGHT_SCHEMA,
      temperature: 0.3,
      maxTokens: 1500,
    }, { tenantId, feature: 'insight_gen' });

    if (aiRes.ok && aiRes.data?.insights?.length) {
      for (const ins of aiRes.data.insights as any[]) {
        insights.push(ins);
      }
    }
  }

  // Persist insights and actions
  const created = {
    insights: [] as any[],
    actions: [] as any[],
  };

  for (const ins of insights) {
    const created_ins = await db.aIInsight.create({
      data: {
        tenantId,
        title: ins.title,
        type: ins.type,
        priority: ins.priority,
        evidence: JSON.stringify(ins.evidence || []),
        sourceRefs: JSON.stringify(ins.sourceRefs || []),
        recommendedAction: ins.recommendedAction || '',
        confidence: ins.confidence ?? 70,
        uncertainty: ins.uncertainty || '',
        category: ins.category || 'general',
        status: 'active',
      },
    });
    created.insights.push(created_ins);

    if (ins.actionTitle) {
      const act = await db.aIAction.create({
        data: {
          tenantId,
          insightId: created_ins.id,
          title: ins.actionTitle,
          description: ins.actionDescription || ins.recommendedAction || '',
          category: ins.actionCategory || 'custom',
          priority: ins.priority || 'medium',
          payload: JSON.stringify({
            sourceRefs: ins.sourceRefs || [],
            recommendedAction: ins.recommendedAction || '',
            insightId: created_ins.id,
          }),
          status: 'pending',
          requiresApproval: ins.requiresApproval ?? true,
          riskLevel: ins.riskLevel || 'low',
        },
      });
      created.actions.push(act);
    }
  }

  return created;
}

// ============================================================
// "What should I do now?" — prioritized action list
// ============================================================

export async function whatShouldIDoNow(tenantId: string, userId: string) {
  const snapshot = await buildSnapshot(tenantId);
  const recs: any[] = [];

  if (snapshot.paymentsOverdueCount > 0) {
    recs.push({
      what: `Collect ${snapshot.paymentsOverdueCount} overdue payments worth ₹${formatINR(snapshot.paymentsOverdueAmount)}`,
      why: 'Cash flow is the lifeblood of any business. Overdue payments hurt working capital.',
      evidence: snapshot.topOverduePayments.slice(0, 3).map((p) => `Invoice ${p.number} — ${p.customer} — ₹${formatINR(p.amount)} — due ${new Date(p.dueDate!).toLocaleDateString()}`),
      expectedImpact: `Recover up to ₹${formatINR(snapshot.paymentsOverdueAmount)} in receivables.`,
      nextAction: 'Approve the AI-suggested collection tasks in the Action Center.',
      priority: 1,
    });
  }

  if (snapshot.quotationsStaleCount > 0) {
    recs.push({
      what: `Chase ${snapshot.quotationsStaleCount} stale quotations worth ₹${formatINR(snapshot.quotationsStaleValue)}`,
      why: 'Stale quotations (>3 days without response) have a much lower close rate.',
      evidence: snapshot.topStaleQuotations.slice(0, 3).map((q) => `Quotation ${q.number} — ₹${formatINR(q.amount)} — sent ${q.sentAt ? new Date(q.sentAt).toLocaleDateString() : 'n/a'}`),
      expectedImpact: `Recover up to ₹${formatINR(snapshot.quotationsStaleValue)} in pipeline.`,
      nextAction: 'Approve the follow-up tasks in the Action Center or call the leads directly.',
      priority: 2,
    });
  }

  if (snapshot.leadsNeedingFollowup > 0) {
    recs.push({
      what: `Follow up with ${snapshot.leadsNeedingFollowup} leads with no activity in 7 days`,
      why: 'Leads go cold quickly. A timely follow-up dramatically increases conversion.',
      evidence: snapshot.topLeadsNeedingFollowup.slice(0, 3).map((l) => `Lead: ${l.name} (${l.email || l.phone || 'no contact'}) — last activity: ${l.lastActivityAt ? new Date(l.lastActivityAt).toLocaleDateString() : 'never'}`),
      expectedImpact: 'Increase conversion rate of existing lead pool without new acquisition spend.',
      nextAction: 'Approve follow-up tasks in the Action Center, or call directly from Telecaller.',
      priority: 3,
    });
  }

  if (snapshot.lowStockCount > 0) {
    recs.push({
      what: `Restock ${snapshot.lowStockCount} products below reorder level`,
      why: 'Stock-outs cause lost sales and customer dissatisfaction.',
      evidence: snapshot.topLowStockProducts.slice(0, 3).map((p) => `${p.product} (${p.sku}): ${p.quantity} ≤ reorder ${p.reorderLevel}`),
      expectedImpact: 'Avoid lost sales from stock-outs.',
      nextAction: 'Approve purchase recommendations in the Action Center.',
      priority: 4,
    });
  }

  if (snapshot.tasksOverdue > 0) {
    recs.push({
      what: `Review ${snapshot.tasksOverdue} overdue tasks`,
      why: 'Overdue tasks signal blocked work. Owners may need help or reassignment.',
      evidence: snapshot.topOverdueTasks.slice(0, 3).map((t) => `${t.title} — due ${t.dueDate ? new Date(t.dueDate).toLocaleDateString() : 'no date'} — priority ${t.priority}`),
      expectedImpact: 'Unblock stalled work and meet commitments.',
      nextAction: 'Review and either reschedule or escalate.',
      priority: 5,
    });
  }

  if (recs.length === 0) {
    recs.push({
      what: 'No critical actions right now',
      why: 'All monitored business signals are within normal range.',
      evidence: ['Snapshot generated with no risk-level insights.'],
      expectedImpact: 'Use the time to invest in growth: lead generation, customer outreach, or process improvement.',
      nextAction: 'Review the Analytics page for trends and the Advisor for strategic questions.',
      priority: 99,
    });
  }

  return recs.sort((a, b) => a.priority - b.priority);
}

// ============================================================
// AI Business Advisor — natural-language Q&A over tenant data
// ============================================================

const ADVISOR_SCHEMA = z.object({
  answer: z.string(),
  sections: z.array(z.object({
    type: z.enum(['FACT', 'CALCULATION', 'INFERENCE', 'RECOMMENDATION']),
    text: z.string(),
    evidence: z.array(z.string()).default([]),
  })),
  insufficientData: z.boolean().default(false),
});

export async function askAdvisor(tenantId: string, question: string) {
  const snapshot = await buildSnapshot(tenantId);
  const dna = await getBusinessDNA(tenantId);
  const ctx = buildBusinessContext(dna, null);

  const prompt = `${assertFacts('Answer the owner question using ONLY the data below. Mark each section as FACT, CALCULATION, INFERENCE, or RECOMMENDATION. If data is insufficient, set insufficientData=true.')}\n\nBusiness context:\n${ctx}\n\nBusiness snapshot (this is your only data source):\n${JSON.stringify(snapshot, null, 2)}\n\nOwner question:\n${question}`;
  const aiRes = await callAI({
    prompt,
    systemPrompt: 'You are the OPERA AI Business Advisor. NEVER invent facts. Use only the provided snapshot. Be concise and structured.',
    outputSchema: ADVISOR_SCHEMA,
    temperature: 0.3,
    maxTokens: 1200,
  }, { tenantId, feature: 'advisor' });

  if (aiRes.ok && aiRes.data) {
    return aiRes.data;
  }
  return {
    answer: 'AI advisor temporarily unavailable. Please try again later.',
    sections: [
      { type: 'FACT' as const, text: `Snapshot shows: ${snapshot.leadsTotal} leads, ${snapshot.customersTotal} customers, ${snapshot.quotationsTotal} quotations, ${snapshot.paymentsOverdueCount} overdue payments.`, evidence: [] },
    ],
    insufficientData: false,
  };
}

// ============================================================
// Action execution (only approved actions)
// ============================================================

export async function executeAction(actionId: string, userId: string, tenantId: string) {
  const action = await db.aIAction.findFirst({ where: { id: actionId, tenantId } });
  if (!action) return { ok: false, error: 'not_found' };
  if (action.requiresApproval && action.status !== 'approved') {
    return { ok: false, error: 'not_approved' };
  }
  if (action.status === 'completed' || action.status === 'executing') {
    return { ok: false, error: 'invalid_state' };
  }

  // Mark executing
  await db.aIAction.update({ where: { id: actionId }, data: { status: 'executing', executorId: userId, executedAt: new Date() } });
  const exec = await db.aIExecution.create({
    data: { tenantId, actionId, status: 'running', startedAt: new Date(), byUserId: userId },
  });

  let result = '';
  let execStatus: 'success' | 'failed' = 'success';
  let execError = '';
  try {
    const payload = JSON.parse(action.payload || '{}');
    const sourceRefs: any[] = payload.sourceRefs || [];

    switch (action.category) {
      case 'follow_up': {
        // Create follow-up tasks for the referenced leads/quotations
        let created = 0;
        for (const ref of sourceRefs) {
          if (ref.entity === 'lead') {
            await db.followUp.create({
              data: {
                tenantId,
                leadId: ref.id,
                title: `Follow-up: ${action.title}`,
                dueAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
                ownerId: userId,
              },
            });
            created++;
          } else if (ref.entity === 'quotation') {
            const q = await db.quotation.findFirst({ where: { id: ref.id, tenantId } });
            if (q?.leadId) {
              await db.followUp.create({
                data: {
                  tenantId,
                  leadId: q.leadId,
                  title: `Follow-up: ${q.number}`,
                  dueAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
                  ownerId: userId,
                },
              });
              created++;
            }
          }
        }
        result = `Created ${created} follow-up tasks.`;
        break;
      }
      case 'collection': {
        let created = 0;
        for (const ref of sourceRefs) {
          if (ref.entity === 'invoice') {
            const inv = await db.invoice.findFirst({ where: { id: ref.id, tenantId }, include: { customer: true } });
            if (inv) {
              await db.task.create({
                data: {
                  tenantId,
                  title: `Collect payment: ${inv.number} (${inv.customer?.name || ''})`,
                  description: `Invoice ${inv.number} for ₹${formatINR(inv.totalAmount)} is overdue. Due date: ${inv.dueDate?.toISOString() || ''}.`,
                  type: 'collection',
                  status: 'open',
                  priority: 'high',
                  dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
                  customerId: inv.customerId,
                  assigneeId: userId,
                  ownerId: userId,
                },
              });
              created++;
            }
          }
        }
        result = `Created ${created} collection tasks.`;
        break;
      }
      case 'restock': {
        let created = 0;
        for (const ref of sourceRefs) {
          if (ref.entity === 'stockItem') {
            const s = await db.stockItem.findFirst({ where: { id: ref.id, tenantId }, include: { product: true } });
            if (s) {
              await db.task.create({
                data: {
                  tenantId,
                  title: `Restock: ${s.product?.name || ''} (${s.product?.sku || ''})`,
                  description: `Current qty: ${s.quantity}. Reorder level: ${s.reorderLevel}. Suggested order: ${Math.max(s.reorderLevel * 2 - s.quantity, s.reorderLevel)}.`,
                  type: 'general',
                  status: 'open',
                  priority: 'medium',
                  dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
                  assigneeId: userId,
                  ownerId: userId,
                },
              });
              created++;
            }
          }
        }
        result = `Created ${created} restock tasks.`;
        break;
      }
      case 'notify': {
        result = 'Notification queued.';
        break;
      }
      case 'reengage': {
        result = 'Re-engagement list prepared. See Action Center.';
        break;
      }
      default: {
        result = 'Action completed.';
      }
    }

    await db.aIAction.update({ where: { id: actionId }, data: { status: 'completed', executionResult: result, executedAt: new Date() } });
    await db.aIExecution.update({ where: { id: exec.id }, data: { status: 'success', endedAt: new Date(), result } });
    if (action.insightId) {
      await db.aIInsight.update({ where: { id: action.insightId }, data: { status: 'resolved' } });
    }
  } catch (e) {
    execStatus = 'failed';
    execError = (e as Error).message;
    await db.aIAction.update({ where: { id: actionId }, data: { status: 'failed', executionResult: execError } });
    await db.aIExecution.update({ where: { id: exec.id }, data: { status: 'failed', endedAt: new Date(), error: execError } });
  }

  return { ok: execStatus === 'success', result, error: execError };
}

// ============================================================
// Helpers
// ============================================================

export function formatINR(paise: number): string {
  const rupees = paise / 100;
  return rupees.toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

export function formatMoney(rupees: number): string {
  return rupees.toLocaleString('en-IN', { maximumFractionDigits: 0 });
}
