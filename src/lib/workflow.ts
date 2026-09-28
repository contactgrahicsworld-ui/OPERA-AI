// OPERA AI — Workflow Engine
// Industry-agnostic. Trigger → Conditions → Actions → Approval → Execution → Result → Audit.

import { db } from './db';
import { audit } from './audit';

export interface WorkflowContext {
  tenantId: string;
  trigger: string;
  entityRef?: { entity: string; id: string };
  triggerData?: Record<string, any>;
  userId?: string;
}

const ACTION_HANDLERS: Record<string, (ctx: WorkflowContext, payload: any) => Promise<string>> = {
  assign_owner: async (ctx, payload) => {
    if (payload.entity === 'lead' && payload.entityId) {
      await db.lead.update({ where: { id: payload.entityId }, data: { ownerId: payload.ownerId } });
      return `Lead ${payload.entityId} assigned to ${payload.ownerId}`;
    }
    return `assign_owner skipped (unsupported entity)`;
  },
  create_followup: async (ctx, payload) => {
    const dueAt = new Date(Date.now() + (payload.delayHours || 24) * 60 * 60 * 1000);
    await db.followUp.create({
      data: {
        tenantId: ctx.tenantId,
        leadId: payload.entity === 'lead' ? payload.entityId : null,
        customerId: payload.entity === 'customer' ? payload.entityId : null,
        title: payload.title || 'Workflow follow-up',
        dueAt,
        ownerId: payload.ownerId,
      },
    });
    return `Follow-up created: ${payload.title || 'workflow follow-up'}`;
  },
  notify_owner: async (ctx, payload) => {
    if (payload.ownerId) {
      await db.notification.create({
        data: {
          tenantId: ctx.tenantId,
          userId: payload.ownerId,
          type: payload.type || 'info',
          title: payload.title || 'Workflow notification',
          body: payload.body || '',
          link: payload.link || '',
          isRead: false,
        },
      });
      return `Notified user ${payload.ownerId}`;
    }
    return `notify_owner skipped (no owner)`;
  },
  create_collection_task: async (ctx, payload) => {
    await db.task.create({
      data: {
        tenantId: ctx.tenantId,
        title: payload.title || 'Collection task',
        description: payload.description || '',
        type: 'collection',
        status: 'open',
        priority: 'high',
        dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
        customerId: payload.entity === 'customer' ? payload.entityId : payload.customerId,
        assigneeId: payload.ownerId,
        ownerId: payload.ownerId,
      },
    });
    return `Collection task created: ${payload.title || ''}`;
  },
  create_purchase_recommendation: async (ctx, payload) => {
    await db.task.create({
      data: {
        tenantId: ctx.tenantId,
        title: payload.title || 'Purchase recommendation',
        description: payload.description || '',
        type: 'general',
        status: 'open',
        priority: 'medium',
        dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        assigneeId: payload.ownerId,
        ownerId: payload.ownerId,
      },
    });
    return `Purchase recommendation created`;
  },
  ai_reengagement_recommendation: async (ctx, payload) => {
    // Create an AI insight record (the AI Brain will pick this up)
    await db.aIInsight.create({
      data: {
        tenantId: ctx.tenantId,
        title: payload.title || 'Re-engage inactive customer',
        type: 'opportunity',
        priority: 'medium',
        evidence: JSON.stringify(payload.evidence || ['Customer marked inactive']),
        sourceRefs: JSON.stringify(payload.sourceRefs || []),
        recommendedAction: 'Reach out with a personalised re-engagement offer.',
        confidence: 70,
        uncertainty: 'Customer may have moved to a competitor.',
        category: 'customer',
        status: 'active',
      },
    });
    return `Re-engagement recommendation recorded`;
  },
};

export async function runWorkflow(ctx: WorkflowContext) {
  // Find automations matching this trigger
  const automations = await db.automation.findMany({
    where: { tenantId: ctx.tenantId, trigger: ctx.trigger, isActive: true },
  });

  const results: string[] = [];
  for (const auto of automations) {
    const conditions = safeParseJSON(auto.conditions);
    const actions = safeParseJSON(auto.actions) as any[];
    if (!Array.isArray(actions)) continue;

    // Evaluate conditions (very simple DSL: { days_inactive_gte: 3 })
    if (!evaluateConditions(conditions, ctx)) continue;

    if (auto.requiresApproval) {
      // Create an AI action that requires human approval.
      const aiAct = await db.aIAction.create({
        data: {
          tenantId: ctx.tenantId,
          title: `Workflow: ${auto.name}`,
          description: `Automation triggered: ${auto.trigger}`,
          category: actions[0]?.handler || 'custom',
          priority: 'medium',
          payload: JSON.stringify({ actions, context: ctx }),
          status: 'pending',
          requiresApproval: true,
          riskLevel: 'medium',
        },
      });
      results.push(`Workflow ${auto.name} queued for approval (AIAction ${aiAct.id})`);
    } else {
      // Execute actions immediately
      for (const act of actions) {
        const handler = ACTION_HANDLERS[act.handler];
        if (handler) {
          const r = await handler(ctx, { ...act.params, entity: ctx.entityRef?.entity, entityId: ctx.entityRef?.id });
          results.push(r);
        }
      }
    }

    await db.automationRun.create({
      data: {
        tenantId: ctx.tenantId,
        automationId: auto.id,
        triggerRef: ctx.entityRef?.id || '',
        status: 'executed',
        result: results.join(' | '),
      },
    });
    await db.automation.update({ where: { id: auto.id }, data: { runCount: { increment: 1 } } });
  }

  // Audit
  await audit({
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    action: 'workflow_run',
    entity: 'workflow',
    entityId: ctx.trigger,
    details: `trigger=${ctx.trigger} automations_run=${automations.length} results=${results.length}`,
  });

  return results;
}

function evaluateConditions(conditions: any, ctx: WorkflowContext): boolean {
  if (!conditions || typeof conditions !== 'object') return true;
  for (const [key, val] of Object.entries(conditions)) {
    if (key === 'days_inactive_gte') {
      const last = ctx.triggerData?.lastActivityAt;
      if (!last) return false;
      const days = (Date.now() - new Date(last).getTime()) / (24 * 60 * 60 * 1000);
      if (days < (val as number)) return false;
    }
    if (key === 'stage_equals') {
      if (ctx.triggerData?.stage !== val) return false;
    }
    if (key === 'status_equals') {
      if (ctx.triggerData?.status !== val) return false;
    }
  }
  return true;
}

function safeParseJSON(s: string): any {
  if (!s) return {};
  try {
    return JSON.parse(s);
  } catch {
    return {};
  }
}

// ============================================================
// Built-in default workflows (installed on onboarding)
// ============================================================

export const DEFAULT_WORKFLOWS = [
  {
    name: 'New Lead Assignment',
    trigger: 'new_lead',
    conditions: '{}',
    actions: JSON.stringify([
      { handler: 'assign_owner', params: {} },
      { handler: 'create_followup', params: { title: 'Initial follow-up', delayHours: 24 } },
      { handler: 'notify_owner', params: { title: 'New lead assigned' } },
    ]),
    requiresApproval: false,
  },
  {
    name: 'Quotation Inactive',
    trigger: 'quotation_inactive',
    conditions: JSON.stringify({ days_inactive_gte: 3 }),
    actions: JSON.stringify([
      { handler: 'create_followup', params: { title: 'Quotation follow-up', delayHours: 4 } },
      { handler: 'notify_owner', params: { title: 'Stale quotation', type: 'warning' } },
    ]),
    requiresApproval: false,
  },
  {
    name: 'Payment Overdue',
    trigger: 'payment_overdue',
    conditions: '{}',
    actions: JSON.stringify([
      { handler: 'create_collection_task', params: {} },
      { handler: 'notify_owner', params: { title: 'Payment overdue', type: 'critical' } },
    ]),
    requiresApproval: false,
  },
  {
    name: 'Low Stock',
    trigger: 'low_stock',
    conditions: '{}',
    actions: JSON.stringify([
      { handler: 'create_purchase_recommendation', params: {} },
    ]),
    requiresApproval: false,
  },
  {
    name: 'Customer Inactive',
    trigger: 'customer_inactive',
    conditions: JSON.stringify({ days_inactive_gte: 30 }),
    actions: JSON.stringify([
      { handler: 'ai_reengagement_recommendation', params: {} },
    ]),
    requiresApproval: true,
  },
];
