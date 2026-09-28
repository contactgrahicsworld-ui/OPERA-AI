// OPERA AI — API route generator
// Generates standardized CRUD API routes for all tenant-scoped entities
// following the same pattern: list (GET), create (POST), update (PATCH),
// delete (DELETE), all with strict tenant isolation.

const fs = require('fs');
const path = require('path');

const ROUTES_DIR = '/home/z/my-project/src/app/api';

const ENTITIES = {
  leads: {
    model: 'lead',
    create: `data: { tenantId, name: d.name, email: d.email || '', phone: d.phone || '', company: d.company || '', source: d.source || 'manual', status: d.status || 'New', stage: d.stage || 'New', ownerId: d.ownerId || null, value: d.value || 0, priority: d.priority || 'medium', tagsCsv: (d.tags || []).join(','), notes: d.notes || '' }`,
    update: `data: { name: d.name, email: d.email, phone: d.phone, company: d.company, source: d.source, status: d.status, stage: d.stage, ownerId: d.ownerId, value: d.value, priority: d.priority, tagsCsv: (d.tags || []).join(','), notes: d.notes, lastActivityAt: d.lastActivityAt }`,
    list: `select: { id: true, name: true, email: true, phone: true, company: true, status: true, stage: true, ownerId: true, value: true, priority: true, tagsCsv: true, notes: true, lastActivityAt: true, convertedAt: true, createdAt: true, updatedAt: true }`,
  },
  customers: {
    model: 'customer',
    create: `data: { tenantId, name: d.name, email: d.email || '', phone: d.phone || '', company: d.company || '', type: d.type || 'individual', status: 'active', tagsCsv: (d.tags || []).join(',') }`,
    update: `data: { name: d.name, email: d.email, phone: d.phone, company: d.company, type: d.type, status: d.status, tagsCsv: (d.tags || []).join(',') }`,
    list: `select: { id: true, name: true, email: true, phone: true, company: true, type: true, status: true, totalValue: true, lastOrderAt: true, tagsCsv: true, createdAt: true }`,
  },
  contacts: {
    model: 'contact',
    create: `data: { tenantId, name: d.name, email: d.email || '', phone: d.phone || '', companyId: d.companyId || null, position: d.position || '', isPrimary: d.isPrimary || false, tagsCsv: (d.tags || []).join(',') }`,
    update: `data: { name: d.name, email: d.email, phone: d.phone, position: d.position, isPrimary: d.isPrimary, tagsCsv: (d.tags || []).join(',') }`,
    list: `select: { id: true, name: true, email: true, phone: true, position: true, isPrimary: true, tagsCsv: true, companyId: true, createdAt: true }`,
  },
  companies: {
    model: 'company',
    create: `data: { tenantId, name: d.name, website: d.website || '', industry: d.industry || '', email: d.email || '', phone: d.phone || '', address: d.address || '' }`,
    update: `data: { name: d.name, website: d.website, industry: d.industry, email: d.email, phone: d.phone, address: d.address }`,
    list: `select: { id: true, name: true, website: true, industry: true, email: true, phone: true, address: true, createdAt: true }`,
  },
  deals: {
    model: 'deal',
    create: `data: { tenantId, title: d.title, customerId: d.customerId || null, contactId: d.contactId || null, value: d.value || 0, stage: d.stage || 'New', pipelineId: d.pipelineId || null, ownerId: d.ownerId || null, expectedCloseDate: d.expectedCloseDate ? new Date(d.expectedCloseDate) : null, probability: d.probability || 0 }`,
    update: `data: { title: d.title, customerId: d.customerId, contactId: d.contactId, value: d.value, stage: d.stage, ownerId: d.ownerId, expectedCloseDate: d.expectedCloseDate ? new Date(d.expectedCloseDate) : null, probability: d.probability, closedAt: d.closedAt ? new Date(d.closedAt) : null }`,
    list: `select: { id: true, title: true, customerId: true, contactId: true, value: true, stage: true, ownerId: true, expectedCloseDate: true, probability: true, closedAt: true, createdAt: true }`,
  },
  tasks: {
    model: 'task',
    create: `data: { tenantId, title: d.title, description: d.description || '', type: d.type || 'general', status: d.status || 'open', priority: d.priority || 'medium', dueDate: d.dueDate ? new Date(d.dueDate) : null, leadId: d.leadId || null, customerId: d.customerId || null, assigneeId: d.assigneeId || null, ownerId: ctx.session.sub }`,
    update: `data: { title: d.title, description: d.description, type: d.type, status: d.status, priority: d.priority, dueDate: d.dueDate ? new Date(d.dueDate) : null, assigneeId: d.assigneeId, completedAt: d.status === 'done' ? new Date() : null }`,
    list: `select: { id: true, title: true, description: true, type: true, status: true, priority: true, dueDate: true, leadId: true, customerId: true, assigneeId: true, ownerId: true, completedAt: true, createdAt: true }`,
  },
  followups: {
    model: 'followUp',
    create: `data: { tenantId, leadId: d.leadId || null, customerId: d.customerId || null, title: d.title, dueAt: d.dueAt ? new Date(d.dueAt) : new Date(Date.now() + 24*60*60*1000), ownerId: d.ownerId || ctx.session.sub }`,
    update: `data: { title: d.title, dueAt: d.dueAt ? new Date(d.dueAt) : undefined, completedAt: d.completedAt ? new Date(d.completedAt) : undefined, outcome: d.outcome }`,
    list: `select: { id: true, leadId: true, customerId: true, title: true, dueAt: true, completedAt: true, ownerId: true, outcome: true, createdAt: true }`,
  },
  calls: {
    model: 'call',
    create: `data: { tenantId, leadId: d.leadId || null, customerId: d.customerId || null, contactId: d.contactId || null, callerId: ctx.session.sub, direction: d.direction || 'outbound', status: d.status || 'planned', outcome: d.outcome || '', duration: d.duration || 0, notes: d.notes || '', nextFollowUpAt: d.nextFollowUpAt ? new Date(d.nextFollowUpAt) : null, telecaller: 'human' }`,
    update: `data: { direction: d.direction, status: d.status, outcome: d.outcome, duration: d.duration, notes: d.notes, nextFollowUpAt: d.nextFollowUpAt ? new Date(d.nextFollowUpAt) : null }`,
    list: `select: { id: true, leadId: true, customerId: true, contactId: true, callerId: true, direction: true, status: true, outcome: true, duration: true, notes: true, nextFollowUpAt: true, telecaller: true, createdAt: true }`,
  },
  meetings: {
    model: 'meeting',
    create: `data: { tenantId, title: d.title, leadId: d.leadId || null, customerId: d.customerId || null, attendeeIds: (d.attendeeIds || []).join(','), location: d.location || '', scheduledAt: new Date(d.scheduledAt), endedAt: d.endedAt ? new Date(d.endedAt) : null, notes: d.notes || '', outcome: d.outcome || '', ownerId: ctx.session.sub }`,
    update: `data: { title: d.title, attendeeIds: (d.attendeeIds || []).join(','), location: d.location, scheduledAt: new Date(d.scheduledAt), endedAt: d.endedAt ? new Date(d.endedAt) : null, notes: d.notes, outcome: d.outcome }`,
    list: `select: { id: true, title: true, leadId: true, customerId: true, attendeeIds: true, location: true, scheduledAt: true, endedAt: true, notes: true, outcome: true, ownerId: true, createdAt: true }`,
  },
  activities: {
    model: 'activity',
    create: `data: { tenantId, type: d.type || 'other', title: d.title, description: d.description || '', leadId: d.leadId || null, customerId: d.customerId || null, ownerId: ctx.session.sub, outcome: d.outcome || '', scheduledAt: d.scheduledAt ? new Date(d.scheduledAt) : null, completedAt: d.completedAt ? new Date(d.completedAt) : null }`,
    update: `data: { type: d.type, title: d.title, description: d.description, outcome: d.outcome, scheduledAt: d.scheduledAt ? new Date(d.scheduledAt) : null, completedAt: d.completedAt ? new Date(d.completedAt) : null }`,
    list: `select: { id: true, type: true, title: true, description: true, leadId: true, customerId: true, ownerId: true, outcome: true, scheduledAt: true, completedAt: true, createdAt: true }`,
  },
  notes: {
    model: 'note',
    create: `data: { tenantId, leadId: d.leadId || null, customerId: d.customerId || null, content: d.content, ownerId: ctx.session.sub }`,
    update: `data: { content: d.content }`,
    list: `select: { id: true, leadId: true, customerId: true, content: true, ownerId: true, createdAt: true }`,
  },
  quotations: {
    model: 'quotation',
    create: `data: { tenantId, number: d.number || ('Q-' + Date.now()), leadId: d.leadId || null, customerId: d.customerId || null, subject: d.subject, status: d.status || 'draft', totalAmount: d.totalAmount || 0, discount: d.discount || 0, taxAmount: d.taxAmount || 0, currency: d.currency || 'INR', validTill: d.validTill ? new Date(d.validTill) : null, ownerId: ctx.session.sub, items: JSON.stringify(d.items || []) }`,
    update: `data: { subject: d.subject, status: d.status, totalAmount: d.totalAmount, discount: d.discount, taxAmount: d.taxAmount, validTill: d.validTill ? new Date(d.validTill) : null, sentAt: d.status === 'sent' ? new Date() : undefined, approvedAt: d.status === 'approved' ? new Date() : undefined, items: JSON.stringify(d.items || []) }`,
    list: `select: { id: true, number: true, leadId: true, customerId: true, subject: true, status: true, totalAmount: true, discount: true, taxAmount: true, currency: true, validTill: true, sentAt: true, approvedAt: true, ownerId: true, items: true, createdAt: true }`,
  },
  orders: {
    model: 'order',
    create: `data: { tenantId, number: d.number || ('O-' + Date.now()), quotationId: d.quotationId || null, customerId: d.customerId, status: d.status || 'pending', totalAmount: d.totalAmount || 0, currency: d.currency || 'INR', items: JSON.stringify(d.items || []), ownerId: ctx.session.sub }`,
    update: `data: { status: d.status, totalAmount: d.totalAmount, items: JSON.stringify(d.items || []) }`,
    list: `select: { id: true, number: true, quotationId: true, customerId: true, status: true, totalAmount: true, currency: true, items: true, ownerId: true, createdAt: true }`,
  },
  payments: {
    model: 'payment',
    create: `data: { tenantId, number: d.number || ('P-' + Date.now()), customerId: d.customerId || null, orderId: d.orderId || null, invoiceId: d.invoiceId || null, amount: d.amount, currency: d.currency || 'INR', method: d.method || 'cash', status: d.status || 'received', paidAt: d.paidAt ? new Date(d.paidAt) : new Date(), notes: d.notes || '' }`,
    update: `data: { amount: d.amount, method: d.method, status: d.status, notes: d.notes }`,
    list: `select: { id: true, number: true, customerId: true, orderId: true, invoiceId: true, amount: true, currency: true, method: true, status: true, paidAt: true, notes: true, createdAt: true }`,
  },
  invoices: {
    model: 'invoice',
    create: `data: { tenantId, number: d.number || ('INV-' + Date.now()), customerId: d.customerId, orderId: d.orderId || null, amount: d.amount, taxAmount: d.taxAmount || 0, totalAmount: d.totalAmount || d.amount, currency: d.currency || 'INR', status: d.status || 'unpaid', dueDate: d.dueDate ? new Date(d.dueDate) : null }`,
    update: `data: { amount: d.amount, taxAmount: d.taxAmount, totalAmount: d.totalAmount, status: d.status, dueDate: d.dueDate ? new Date(d.dueDate) : null, paidAt: d.status === 'paid' ? new Date() : null }`,
    list: `select: { id: true, number: true, customerId: true, orderId: true, amount: true, taxAmount: true, totalAmount: true, currency: true, status: true, dueDate: true, paidAt: true, createdAt: true }`,
  },
  expenses: {
    model: 'expense',
    create: `data: { tenantId, category: d.category || 'general', description: d.description, amount: d.amount, currency: d.currency || 'INR', paidBy: d.paidBy || null, paidAt: d.paidAt ? new Date(d.paidAt) : new Date(), receiptUrl: d.receiptUrl || null }`,
    update: `data: { category: d.category, description: d.description, amount: d.amount, paidAt: d.paidAt ? new Date(d.paidAt) : null, receiptUrl: d.receiptUrl }`,
    list: `select: { id: true, category: true, description: true, amount: true, currency: true, paidBy: true, paidAt: true, receiptUrl: true, createdAt: true }`,
  },
  employees: {
    model: 'employee',
    create: `data: { tenantId, userId: d.userId || null, name: d.name, email: d.email || '', phone: d.phone || '', position: d.position || '', departmentId: d.departmentId || null, type: d.type || 'full_time', status: 'active', joinedAt: d.joinedAt ? new Date(d.joinedAt) : new Date(), salary: d.salary || 0 }`,
    update: `data: { name: d.name, position: d.position, departmentId: d.departmentId, type: d.type, status: d.status, salary: d.salary }`,
    list: `select: { id: true, userId: true, name: true, email: true, phone: true, position: true, departmentId: true, type: true, status: true, joinedAt: true, salary: true, createdAt: true }`,
  },
  departments: {
    model: 'department',
    create: `data: { tenantId, name: d.name, headId: d.headId || null }`,
    update: `data: { name: d.name, headId: d.headId }`,
    list: `select: { id: true, name: true, headId: true, createdAt: true }`,
  },
  attendance: {
    model: 'attendance',
    create: `data: { tenantId, employeeId: d.employeeId, date: new Date(d.date), checkIn: d.checkIn ? new Date(d.checkIn) : null, checkOut: d.checkOut ? new Date(d.checkOut) : null, status: d.status || 'present', notes: d.notes || '' }`,
    update: `data: { checkIn: d.checkIn ? new Date(d.checkIn) : null, checkOut: d.checkOut ? new Date(d.checkOut) : null, status: d.status, notes: d.notes }`,
    list: `select: { id: true, employeeId: true, date: true, checkIn: true, checkOut: true, status: true, notes: true, createdAt: true }`,
  },
  leaves: {
    model: 'leave',
    create: `data: { tenantId, employeeId: d.employeeId, type: d.type || 'casual', startDate: new Date(d.startDate), endDate: new Date(d.endDate), status: 'pending', reason: d.reason || '' }`,
    update: `data: { status: d.status, reason: d.reason }`,
    list: `select: { id: true, employeeId: true, type: true, startDate: true, endDate: true, status: true, reason: true, createdAt: true }`,
  },
  products: {
    model: 'product',
    create: `data: { tenantId, name: d.name, sku: d.sku || ('SKU-' + Date.now()), type: d.type || 'product', category: d.category || '', description: d.description || '', price: d.price || 0, cost: d.cost || 0, unit: d.unit || 'unit', taxRate: d.taxRate || 0, isActive: true }`,
    update: `data: { name: d.name, sku: d.sku, category: d.category, description: d.description, price: d.price, cost: d.cost, unit: d.unit, taxRate: d.taxRate, isActive: d.isActive }`,
    list: `select: { id: true, name: true, sku: true, type: true, category: true, description: true, price: true, cost: true, unit: true, taxRate: true, isActive: true, createdAt: true }`,
  },
  warehouses: {
    model: 'warehouse',
    create: `data: { tenantId, name: d.name, location: d.location || '' }`,
    update: `data: { name: d.name, location: d.location }`,
    list: `select: { id: true, name: true, location: true, createdAt: true }`,
  },
  suppliers: {
    model: 'supplier',
    create: `data: { tenantId, name: d.name, email: d.email || '', phone: d.phone || '', address: d.address || '' }`,
    update: `data: { name: d.name, email: d.email, phone: d.phone, address: d.address }`,
    list: `select: { id: true, name: true, email: true, phone: true, address: true, createdAt: true }`,
  },
  purchase_orders: {
    model: 'purchaseOrder',
    create: `data: { tenantId, number: d.number || ('PO-' + Date.now()), supplierId: d.supplierId, status: d.status || 'draft', totalAmount: d.totalAmount || 0, items: JSON.stringify(d.items || []) }`,
    update: `data: { status: d.status, totalAmount: d.totalAmount, items: JSON.stringify(d.items || []) }`,
    list: `select: { id: true, number: true, supplierId: true, status: true, totalAmount: true, items: true, createdAt: true }`,
  },
  campaigns: {
    model: 'campaign',
    create: `data: { tenantId, name: d.name, channel: d.channel || 'manual', status: d.status || 'planned', budget: d.budget || 0, spent: 0, startDate: d.startDate ? new Date(d.startDate) : null, endDate: d.endDate ? new Date(d.endDate) : null }`,
    update: `data: { name: d.name, channel: d.channel, status: d.status, budget: d.budget, spent: d.spent, startDate: d.startDate ? new Date(d.startDate) : null, endDate: d.endDate ? new Date(d.endDate) : null }`,
    list: `select: { id: true, name: true, channel: true, status: true, budget: true, spent: true, leadsCount: true, conversions: true, startDate: true, endDate: true, createdAt: true }`,
  },
  lead_sources: {
    model: 'leadSource',
    create: `data: { tenantId, name: d.name, type: d.type || 'manual', isActive: d.isActive !== false }`,
    update: `data: { name: d.name, type: d.type, isActive: d.isActive }`,
    list: `select: { id: true, name: true, type: true, leadsCount: true, isActive: true, createdAt: true }`,
  },
  automations: {
    model: 'automation',
    create: `data: { tenantId, name: d.name, trigger: d.trigger, conditions: JSON.stringify(d.conditions || {}), actions: JSON.stringify(d.actions || []), requiresApproval: d.requiresApproval || false, isActive: true }`,
    update: `data: { name: d.name, trigger: d.trigger, conditions: JSON.stringify(d.conditions || {}), actions: JSON.stringify(d.actions || []), requiresApproval: d.requiresApproval, isActive: d.isActive }`,
    list: `select: { id: true, name: true, trigger: true, conditions: true, actions: true, requiresApproval: true, isActive: true, runCount: true, createdAt: true }`,
  },
  custom_fields: {
    model: 'customField',
    create: `data: { tenantId, entity: d.entity, key: d.key, label: d.label, type: d.type || 'text', options: JSON.stringify(d.options || []), isRequired: d.isRequired || false, isActive: true }`,
    update: `data: { label: d.label, type: d.type, options: JSON.stringify(d.options || []), isRequired: d.isRequired, isActive: d.isActive }`,
    list: `select: { id: true, entity: true, key: true, label: true, type: true, options: true, isRequired: true, isActive: true, createdAt: true }`,
  },
  pipelines: {
    model: 'pipeline',
    create: `data: { tenantId, name: d.name, entity: d.entity || 'lead', stagesCsv: (d.stages || []).join(','), isDefault: d.isDefault || false }`,
    update: `data: { name: d.name, entity: d.entity, stagesCsv: (d.stages || []).join(','), isDefault: d.isDefault }`,
    list: `select: { id: true, name: true, entity: true, stagesCsv: true, isDefault: true, createdAt: true }`,
  },
  notifications: {
    model: 'notification',
    create: `data: { tenantId, userId: d.userId || null, type: d.type || 'info', title: d.title, body: d.body || '', link: d.link || '', isRead: false }`,
    update: `data: { isRead: d.isRead }`,
    list: `select: { id: true, userId: true, type: true, title: true, body: true, link: true, isRead: true, createdAt: true }`,
  },
};

const TEMPLATE = (entity, cfg) => `// AUTO-GENERATED CRUD route for ${entity}
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { withTenant, qp, quickAudit, type AuthContext } from '@/lib/api-helpers';
import { runWorkflow } from '@/lib/workflow';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  return withTenant(req, async (ctx: AuthContext) => {
    const search = qp(req, 'search');
    const status = qp(req, 'status');
    const limit = parseInt(qp(req, 'limit', '50'));
    const offset = parseInt(qp(req, 'offset', '0'));

    const where: any = { tenantId: ctx.tenantId };
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { email: { contains: search } },
        { phone: { contains: search } },
        { title: { contains: search } },
        { subject: { contains: search } },
        { description: { contains: search } },
        { number: { contains: search } },
      ];
    }

    const [items, total] = await Promise.all([
      (db as any).${cfg.model}.findMany({
        where,
        ${cfg.list},
        orderBy: { createdAt: 'desc' },
        take: Math.min(limit, 200),
        skip: offset,
      }),
      (db as any).${cfg.model}.count({ where }),
    ]);

    return { items, total, limit, offset };
  });
}

export async function POST(req: NextRequest) {
  return withTenant(req, async (ctx: AuthContext) => {
    const d = await req.json().catch(() => ({}));
    const created = await (db as any).${cfg.model}.create({ ${cfg.create} });
    await quickAudit(ctx, 'create', '${cfg.model}', created.id, JSON.stringify(d).slice(0, 500));

    // Fire workflow triggers
    if ('${cfg.model}' === 'lead') {
      await runWorkflow({ tenantId: ctx.tenantId, trigger: 'new_lead', entityRef: { entity: 'lead', id: created.id }, triggerData: { stage: created.stage, status: created.status }, userId: ctx.session.sub });
    }
    if ('${cfg.model}' === 'quotation' && created.status === 'sent') {
      await runWorkflow({ tenantId: ctx.tenantId, trigger: 'quotation_inactive', entityRef: { entity: 'quotation', id: created.id }, triggerData: { status: 'sent', lastActivityAt: created.sentAt || new Date().toISOString() }, userId: ctx.session.sub });
    }
    if ('${cfg.model}' === 'invoice' && created.dueDate && new Date(created.dueDate) < new Date()) {
      await runWorkflow({ tenantId: ctx.tenantId, trigger: 'payment_overdue', entityRef: { entity: 'invoice', id: created.id }, triggerData: { status: 'overdue' }, userId: ctx.session.sub });
    }

    return created;
  });
}

export async function PATCH(req: NextRequest) {
  return withTenant(req, async (ctx: AuthContext) => {
    const d = await req.json().catch(() => ({}));
    const id = qp(req, 'id') || d.id;
    if (!id) return NextResponse.json({ error: 'id_required' }, { status: 400 });

    const existing = await (db as any).${cfg.model}.findFirst({ where: { id, tenantId: ctx.tenantId } });
    if (!existing) return NextResponse.json({ error: 'not_found' }, { status: 404 });

    const updated = await (db as any).${cfg.model}.update({ where: { id }, ${cfg.update} });
    await quickAudit(ctx, 'update', '${cfg.model}', id, JSON.stringify(d).slice(0, 500));
    return updated;
  });
}

export async function DELETE(req: NextRequest) {
  return withTenant(req, async (ctx: AuthContext) => {
    const id = qp(req, 'id');
    if (!id) return NextResponse.json({ error: 'id_required' }, { status: 400 });
    const existing = await (db as any).${cfg.model}.findFirst({ where: { id, tenantId: ctx.tenantId } });
    if (!existing) return NextResponse.json({ error: 'not_found' }, { status: 404 });
    await (db as any).${cfg.model}.delete({ where: { id } });
    await quickAudit(ctx, 'delete', '${cfg.model}', id);
    return { ok: true };
  });
}
`;

let generated = 0;
for (const [entity, cfg] of Object.entries(ENTITIES)) {
  const dir = path.join(ROUTES_DIR, entity);
  fs.mkdirSync(dir, { recursive: true });
  const filePath = path.join(dir, 'route.ts');
  fs.writeFileSync(filePath, TEMPLATE(entity, cfg));
  generated++;
}
console.log(`Generated ${generated} CRUD route files.`);
