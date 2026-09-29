// OPERA AI — PostgreSQL-aware CRUD route generator
// Generates routes that match prisma/schema.postgres.prisma field types
// (String[] for tags, native Json for items, ctx.tenantId! not shorthand)

const fs = require('fs');
const path = require('path');

const ROUTES_DIR = '/home/z/my-project/src/app/api';

// Each entity has: apiPath, modelName, fields with proper Postgres types
const ENTITIES = {
  leads: {
    model: 'lead',
    searchFields: ['name', 'email', 'phone', 'company'],
    createFields: `tenantId: ctx.tenantId!, name: d.name, email: d.email || '', phone: d.phone || '', company: d.company || '', source: d.source || 'manual', status: d.status || 'New', stage: d.stage || 'New', ownerId: d.ownerId || null, value: d.value || 0, priority: d.priority || 'medium', tags: d.tags || [], notes: d.notes || ''`,
    updateFields: `name: d.name, email: d.email, phone: d.phone, company: d.company, source: d.source, status: d.status, stage: d.stage, ownerId: d.ownerId, value: d.value, priority: d.priority, tags: d.tags || [], notes: d.notes, lastActivityAt: d.lastActivityAt ? new Date(d.lastActivityAt) : undefined`,
    selectFields: `id: true, name: true, email: true, phone: true, company: true, status: true, stage: true, ownerId: true, value: true, priority: true, tags: true, notes: true, lastActivityAt: true, convertedAt: true, createdAt: true, updatedAt: true`,
    filterStatus: ['New', 'Contacted', 'Qualified', 'Won', 'Lost'],
    trigger: 'new_lead',
  },
  customers: {
    model: 'customer',
    searchFields: ['name', 'email', 'phone', 'company'],
    createFields: `tenantId: ctx.tenantId!, name: d.name, email: d.email || '', phone: d.phone || '', company: d.company || '', type: d.type || 'individual', status: 'active', tags: d.tags || []`,
    updateFields: `name: d.name, email: d.email, phone: d.phone, company: d.company, type: d.type, status: d.status, tags: d.tags || []`,
    selectFields: `id: true, name: true, email: true, phone: true, company: true, type: true, status: true, totalValue: true, lastOrderAt: true, tags: true, createdAt: true`,
    filterStatus: ['active', 'inactive', 'churned'],
  },
  contacts: {
    model: 'contact',
    searchFields: ['name', 'email', 'phone'],
    createFields: `tenantId: ctx.tenantId!, name: d.name, email: d.email || '', phone: d.phone || '', companyId: d.companyId || null, position: d.position || '', isPrimary: d.isPrimary || false, tags: d.tags || []`,
    updateFields: `name: d.name, email: d.email, phone: d.phone, position: d.position, isPrimary: d.isPrimary, tags: d.tags || []`,
    selectFields: `id: true, name: true, email: true, phone: true, position: true, isPrimary: true, tags: true, companyId: true, createdAt: true`,
  },
  companies: {
    model: 'company',
    searchFields: ['name', 'email', 'industry'],
    createFields: `tenantId: ctx.tenantId!, name: d.name, website: d.website || '', industry: d.industry || '', email: d.email || '', phone: d.phone || '', address: d.address || ''`,
    updateFields: `name: d.name, website: d.website, industry: d.industry, email: d.email, phone: d.phone, address: d.address`,
    selectFields: `id: true, name: true, website: true, industry: true, email: true, phone: true, address: true, createdAt: true`,
  },
  deals: {
    model: 'deal',
    searchFields: ['title'],
    createFields: `tenantId: ctx.tenantId!, title: d.title, customerId: d.customerId || null, contactId: d.contactId || null, value: d.value || 0, stage: d.stage || 'New', pipelineId: d.pipelineId || null, ownerId: d.ownerId || null, expectedCloseDate: d.expectedCloseDate ? new Date(d.expectedCloseDate) : null, probability: d.probability || 0`,
    updateFields: `title: d.title, customerId: d.customerId, contactId: d.contactId, value: d.value, stage: d.stage, ownerId: d.ownerId, expectedCloseDate: d.expectedCloseDate ? new Date(d.expectedCloseDate) : null, probability: d.probability, closedAt: d.closedAt ? new Date(d.closedAt) : null`,
    selectFields: `id: true, title: true, customerId: true, contactId: true, value: true, stage: true, ownerId: true, expectedCloseDate: true, probability: true, closedAt: true, createdAt: true`,
    filterStatus: ['New', 'Qualified', 'Proposal', 'Negotiation', 'Won', 'Lost'],
  },
  tasks: {
    model: 'task',
    searchFields: ['title', 'description'],
    createFields: `tenantId: ctx.tenantId!, title: d.title, description: d.description || '', type: d.type || 'general', status: d.status || 'open', priority: d.priority || 'medium', dueDate: d.dueDate ? new Date(d.dueDate) : null, leadId: d.leadId || null, customerId: d.customerId || null, assigneeId: d.assigneeId || null, ownerId: ctx.session.sub`,
    updateFields: `title: d.title, description: d.description, type: d.type, status: d.status, priority: d.priority, dueDate: d.dueDate ? new Date(d.dueDate) : null, assigneeId: d.assigneeId, completedAt: d.status === 'done' ? new Date() : undefined`,
    selectFields: `id: true, title: true, description: true, type: true, status: true, priority: true, dueDate: true, leadId: true, customerId: true, assigneeId: true, ownerId: true, completedAt: true, createdAt: true`,
    filterStatus: ['open', 'in_progress', 'done', 'overdue', 'cancelled'],
  },
  followups: {
    model: 'followUp',
    searchFields: ['title'],
    createFields: `tenantId: ctx.tenantId!, leadId: d.leadId || null, customerId: d.customerId || null, title: d.title, dueAt: d.dueAt ? new Date(d.dueAt) : new Date(Date.now() + 24*60*60*1000), ownerId: d.ownerId || ctx.session.sub`,
    updateFields: `title: d.title, dueAt: d.dueAt ? new Date(d.dueAt) : undefined, completedAt: d.completedAt ? new Date(d.completedAt) : undefined, outcome: d.outcome`,
    selectFields: `id: true, leadId: true, customerId: true, title: true, dueAt: true, completedAt: true, ownerId: true, outcome: true, createdAt: true`,
  },
  calls: {
    model: 'call',
    searchFields: ['outcome', 'notes'],
    createFields: `tenantId: ctx.tenantId!, leadId: d.leadId || null, customerId: d.customerId || null, contactId: d.contactId || null, callerId: ctx.session.sub, direction: d.direction || 'outbound', status: d.status || 'planned', outcome: d.outcome || '', duration: d.duration || 0, notes: d.notes || '', nextFollowUpAt: d.nextFollowUpAt ? new Date(d.nextFollowUpAt) : null, telecaller: 'human'`,
    updateFields: `direction: d.direction, status: d.status, outcome: d.outcome, duration: d.duration, notes: d.notes, nextFollowUpAt: d.nextFollowUpAt ? new Date(d.nextFollowUpAt) : null`,
    selectFields: `id: true, leadId: true, customerId: true, contactId: true, callerId: true, direction: true, status: true, outcome: true, duration: true, notes: true, nextFollowUpAt: true, telecaller: true, createdAt: true`,
    filterStatus: ['planned', 'connected', 'missed', 'failed'],
  },
  meetings: {
    model: 'meeting',
    searchFields: ['title', 'notes'],
    createFields: `tenantId: ctx.tenantId!, title: d.title, leadId: d.leadId || null, customerId: d.customerId || null, attendeeIds: d.attendeeIds || [], location: d.location || '', scheduledAt: d.scheduledAt ? new Date(d.scheduledAt) : new Date(), endedAt: d.endedAt ? new Date(d.endedAt) : null, notes: d.notes || '', outcome: d.outcome || '', ownerId: ctx.session.sub`,
    updateFields: `title: d.title, attendeeIds: d.attendeeIds || [], location: d.location, scheduledAt: d.scheduledAt ? new Date(d.scheduledAt) : undefined, endedAt: d.endedAt ? new Date(d.endedAt) : null, notes: d.notes, outcome: d.outcome`,
    selectFields: `id: true, title: true, leadId: true, customerId: true, attendeeIds: true, location: true, scheduledAt: true, endedAt: true, notes: true, outcome: true, ownerId: true, createdAt: true`,
  },
  activities: {
    model: 'activity',
    searchFields: ['title', 'description'],
    createFields: `tenantId: ctx.tenantId!, type: d.type || 'other', title: d.title, description: d.description || '', leadId: d.leadId || null, customerId: d.customerId || null, ownerId: ctx.session.sub, outcome: d.outcome || '', scheduledAt: d.scheduledAt ? new Date(d.scheduledAt) : null, completedAt: d.completedAt ? new Date(d.completedAt) : null`,
    updateFields: `type: d.type, title: d.title, description: d.description, outcome: d.outcome, scheduledAt: d.scheduledAt ? new Date(d.scheduledAt) : null, completedAt: d.completedAt ? new Date(d.completedAt) : null`,
    selectFields: `id: true, type: true, title: true, description: true, leadId: true, customerId: true, ownerId: true, outcome: true, scheduledAt: true, completedAt: true, createdAt: true`,
    filterStatus: ['call', 'meeting', 'email', 'note', 'task', 'visit', 'other'],
  },
  notes: {
    model: 'note',
    searchFields: ['content'],
    createFields: `tenantId: ctx.tenantId!, leadId: d.leadId || null, customerId: d.customerId || null, content: d.content, ownerId: ctx.session.sub`,
    updateFields: `content: d.content`,
    selectFields: `id: true, leadId: true, customerId: true, content: true, ownerId: true, createdAt: true`,
  },
  quotations: {
    model: 'quotation',
    searchFields: ['number', 'subject'],
    createFields: `tenantId: ctx.tenantId!, number: d.number || ('Q-' + Date.now()), leadId: d.leadId || null, customerId: d.customerId || null, subject: d.subject, status: d.status || 'draft', totalAmount: d.totalAmount || 0, discount: d.discount || 0, taxAmount: d.taxAmount || 0, currency: d.currency || 'INR', validTill: d.validTill ? new Date(d.validTill) : null, ownerId: ctx.session.sub, items: d.items || []`,
    updateFields: `subject: d.subject, status: d.status, totalAmount: d.totalAmount, discount: d.discount, taxAmount: d.taxAmount, validTill: d.validTill ? new Date(d.validTill) : null, sentAt: d.status === 'sent' ? new Date() : undefined, approvedAt: d.status === 'approved' ? new Date() : undefined, items: d.items || []`,
    selectFields: `id: true, number: true, leadId: true, customerId: true, subject: true, status: true, totalAmount: true, discount: true, taxAmount: true, currency: true, validTill: true, sentAt: true, approvedAt: true, ownerId: true, items: true, createdAt: true`,
    filterStatus: ['draft', 'sent', 'approved', 'rejected', 'expired', 'converted'],
    trigger: 'quotation_inactive',
  },
  orders: {
    model: 'order',
    searchFields: ['number'],
    createFields: `tenantId: ctx.tenantId!, number: d.number || ('O-' + Date.now()), quotationId: d.quotationId || null, customerId: d.customerId, status: d.status || 'pending', totalAmount: d.totalAmount || 0, currency: d.currency || 'INR', items: d.items || [], ownerId: ctx.session.sub`,
    updateFields: `status: d.status, totalAmount: d.totalAmount, items: d.items || []`,
    selectFields: `id: true, number: true, quotationId: true, customerId: true, status: true, totalAmount: true, currency: true, items: true, ownerId: true, createdAt: true`,
    filterStatus: ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled', 'returned'],
  },
  payments: {
    model: 'payment',
    searchFields: ['number'],
    createFields: `tenantId: ctx.tenantId!, number: d.number || ('P-' + Date.now()), customerId: d.customerId || null, orderId: d.orderId || null, invoiceId: d.invoiceId || null, amount: d.amount, currency: d.currency || 'INR', method: d.method || 'cash', status: d.status || 'received', paidAt: d.paidAt ? new Date(d.paidAt) : new Date(), notes: d.notes || ''`,
    updateFields: `amount: d.amount, method: d.method, status: d.status, notes: d.notes`,
    selectFields: `id: true, number: true, customerId: true, orderId: true, invoiceId: true, amount: true, currency: true, method: true, status: true, paidAt: true, notes: true, createdAt: true`,
    filterStatus: ['received', 'pending', 'failed', 'refunded'],
  },
  invoices: {
    model: 'invoice',
    searchFields: ['number'],
    createFields: `tenantId: ctx.tenantId!, number: d.number || ('INV-' + Date.now()), customerId: d.customerId, orderId: d.orderId || null, amount: d.amount, taxAmount: d.taxAmount || 0, totalAmount: d.totalAmount || d.amount, currency: d.currency || 'INR', status: d.status || 'unpaid', dueDate: d.dueDate ? new Date(d.dueDate) : null`,
    updateFields: `amount: d.amount, taxAmount: d.taxAmount, totalAmount: d.totalAmount, status: d.status, dueDate: d.dueDate ? new Date(d.dueDate) : null, paidAt: d.status === 'paid' ? new Date() : null`,
    selectFields: `id: true, number: true, customerId: true, orderId: true, amount: true, taxAmount: true, totalAmount: true, currency: true, status: true, dueDate: true, paidAt: true, createdAt: true`,
    filterStatus: ['unpaid', 'partial', 'paid', 'overdue', 'cancelled'],
    trigger: 'payment_overdue',
  },
  expenses: {
    model: 'expense',
    searchFields: ['description', 'category'],
    createFields: `tenantId: ctx.tenantId!, category: d.category || 'general', description: d.description, amount: d.amount, currency: d.currency || 'INR', paidBy: d.paidBy || null, paidAt: d.paidAt ? new Date(d.paidAt) : new Date(), receiptUrl: d.receiptUrl || null`,
    updateFields: `category: d.category, description: d.description, amount: d.amount, paidAt: d.paidAt ? new Date(d.paidAt) : null, receiptUrl: d.receiptUrl`,
    selectFields: `id: true, category: true, description: true, amount: true, currency: true, paidBy: true, paidAt: true, receiptUrl: true, createdAt: true`,
    filterStatus: ['general', 'office', 'travel', 'utilities', 'salaries', 'marketing', 'inventory', 'rent', 'other'],
  },
  employees: {
    model: 'employee',
    searchFields: ['name', 'email'],
    createFields: `tenantId: ctx.tenantId!, userId: d.userId || null, name: d.name, email: d.email || '', phone: d.phone || '', position: d.position || '', departmentId: d.departmentId || null, type: d.type || 'full_time', status: 'active', joinedAt: d.joinedAt ? new Date(d.joinedAt) : new Date(), salary: d.salary || 0`,
    updateFields: `name: d.name, position: d.position, departmentId: d.departmentId, type: d.type, status: d.status, salary: d.salary`,
    selectFields: `id: true, userId: true, name: true, email: true, phone: true, position: true, departmentId: true, type: true, status: true, joinedAt: true, salary: true, createdAt: true`,
    filterStatus: ['active', 'inactive'],
  },
  departments: {
    model: 'department',
    searchFields: ['name'],
    createFields: `tenantId: ctx.tenantId!, name: d.name, headId: d.headId || null`,
    updateFields: `name: d.name, headId: d.headId`,
    selectFields: `id: true, name: true, headId: true, createdAt: true`,
  },
  attendance: {
    model: 'attendance',
    searchFields: [],
    createFields: `tenantId: ctx.tenantId!, employeeId: d.employeeId, date: new Date(d.date), checkIn: d.checkIn ? new Date(d.checkIn) : null, checkOut: d.checkOut ? new Date(d.checkOut) : null, status: d.status || 'present', notes: d.notes || ''`,
    updateFields: `checkIn: d.checkIn ? new Date(d.checkIn) : null, checkOut: d.checkOut ? new Date(d.checkOut) : null, status: d.status, notes: d.notes`,
    selectFields: `id: true, employeeId: true, date: true, checkIn: true, checkOut: true, status: true, notes: true, createdAt: true`,
    filterStatus: ['present', 'absent', 'leave', 'half_day', 'late'],
  },
  leaves: {
    model: 'leave',
    searchFields: ['reason'],
    createFields: `tenantId: ctx.tenantId!, employeeId: d.employeeId, type: d.type || 'casual', startDate: new Date(d.startDate), endDate: new Date(d.endDate), status: 'pending', reason: d.reason || ''`,
    updateFields: `status: d.status, reason: d.reason`,
    selectFields: `id: true, employeeId: true, type: true, startDate: true, endDate: true, status: true, reason: true, createdAt: true`,
    filterStatus: ['pending', 'approved', 'rejected', 'cancelled'],
  },
  products: {
    model: 'product',
    searchFields: ['name', 'sku', 'category'],
    createFields: `tenantId: ctx.tenantId!, name: d.name, sku: d.sku || ('SKU-' + Date.now()), type: d.type || 'product', category: d.category || '', description: d.description || '', price: d.price || 0, cost: d.cost || 0, unit: d.unit || 'unit', taxRate: d.taxRate || 0, isActive: true`,
    updateFields: `name: d.name, sku: d.sku, category: d.category, description: d.description, price: d.price, cost: d.cost, unit: d.unit, taxRate: d.taxRate, isActive: d.isActive`,
    selectFields: `id: true, name: true, sku: true, type: true, category: true, description: true, price: true, cost: true, unit: true, taxRate: true, isActive: true, createdAt: true`,
    filterStatus: ['product', 'service'],
  },
  warehouses: {
    model: 'warehouse',
    searchFields: ['name', 'location'],
    createFields: `tenantId: ctx.tenantId!, name: d.name, location: d.location || ''`,
    updateFields: `name: d.name, location: d.location`,
    selectFields: `id: true, name: true, location: true, createdAt: true`,
  },
  suppliers: {
    model: 'supplier',
    searchFields: ['name', 'email'],
    createFields: `tenantId: ctx.tenantId!, name: d.name, email: d.email || '', phone: d.phone || '', address: d.address || ''`,
    updateFields: `name: d.name, email: d.email, phone: d.phone, address: d.address`,
    selectFields: `id: true, name: true, email: true, phone: true, address: true, createdAt: true`,
  },
  purchase_orders: {
    model: 'purchaseOrder',
    searchFields: ['number'],
    createFields: `tenantId: ctx.tenantId!, number: d.number || ('PO-' + Date.now()), supplierId: d.supplierId, status: d.status || 'draft', totalAmount: d.totalAmount || 0, items: d.items || []`,
    updateFields: `status: d.status, totalAmount: d.totalAmount, items: d.items || []`,
    selectFields: `id: true, number: true, supplierId: true, status: true, totalAmount: true, items: true, createdAt: true`,
    filterStatus: ['draft', 'sent', 'received', 'cancelled'],
  },
  campaigns: {
    model: 'campaign',
    searchFields: ['name'],
    createFields: `tenantId: ctx.tenantId!, name: d.name, channel: d.channel || 'manual', status: d.status || 'planned', budget: d.budget || 0, spent: 0, startDate: d.startDate ? new Date(d.startDate) : null, endDate: d.endDate ? new Date(d.endDate) : null`,
    updateFields: `name: d.name, channel: d.channel, status: d.status, budget: d.budget, spent: d.spent, startDate: d.startDate ? new Date(d.startDate) : null, endDate: d.endDate ? new Date(d.endDate) : null`,
    selectFields: `id: true, name: true, channel: true, status: true, budget: true, spent: true, leadsCount: true, conversions: true, startDate: true, endDate: true, createdAt: true`,
    filterStatus: ['planned', 'active', 'paused', 'completed'],
  },
  lead_sources: {
    model: 'leadSource',
    searchFields: ['name'],
    createFields: `tenantId: ctx.tenantId!, name: d.name, type: d.type || 'manual', isActive: d.isActive !== false`,
    updateFields: `name: d.name, type: d.type, isActive: d.isActive`,
    selectFields: `id: true, name: true, type: true, leadsCount: true, isActive: true, createdAt: true`,
  },
  automations: {
    model: 'automation',
    searchFields: ['name'],
    createFields: `tenantId: ctx.tenantId!, name: d.name, trigger: d.trigger, conditions: d.conditions || {}, actions: d.actions || [], requiresApproval: d.requiresApproval || false, isActive: true`,
    updateFields: `name: d.name, trigger: d.trigger, conditions: d.conditions || {}, actions: d.actions || [], requiresApproval: d.requiresApproval, isActive: d.isActive`,
    selectFields: `id: true, name: true, trigger: true, conditions: true, actions: true, requiresApproval: true, isActive: true, runCount: true, createdAt: true`,
    filterStatus: ['new_lead', 'quotation_inactive', 'payment_overdue', 'low_stock', 'customer_inactive', 'manual', 'scheduled'],
  },
  custom_fields: {
    model: 'customField',
    searchFields: ['label', 'entity', 'key'],
    createFields: `tenantId: ctx.tenantId!, entity: d.entity, key: d.key, label: d.label, type: d.type || 'text', options: d.options || [], isRequired: d.isRequired || false, isActive: true`,
    updateFields: `label: d.label, type: d.type, options: d.options || [], isRequired: d.isRequired, isActive: d.isActive`,
    selectFields: `id: true, entity: true, key: true, label: true, type: true, options: true, isRequired: true, isActive: true, createdAt: true`,
    filterStatus: ['lead', 'customer', 'contact', 'deal', 'quotation', 'order', 'task'],
  },
  pipelines: {
    model: 'pipeline',
    searchFields: ['name'],
    createFields: `tenantId: ctx.tenantId!, name: d.name, entity: d.entity || 'lead', stages: d.stages || ['New', 'Contacted', 'Qualified', 'Won', 'Lost'], isDefault: d.isDefault || false`,
    updateFields: `name: d.name, entity: d.entity, stages: d.stages || [], isDefault: d.isDefault`,
    selectFields: `id: true, name: true, entity: true, stages: true, isDefault: true, createdAt: true`,
    filterStatus: ['lead', 'deal', 'customer'],
  },
  notifications: {
    model: 'notification',
    searchFields: ['title'],
    createFields: `tenantId: ctx.tenantId!, userId: d.userId || null, type: d.type || 'info', title: d.title, body: d.body || '', link: d.link || '', isRead: false`,
    updateFields: `isRead: d.isRead`,
    selectFields: `id: true, userId: true, type: true, title: true, body: true, link: true, isRead: true, createdAt: true`,
  },
};

const TEMPLATE = (entity, cfg) => `// AUTO-GENERATED CRUD route for ${entity} (PostgreSQL-aware)
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
    if (search && ${JSON.stringify(cfg.searchFields)}.length > 0) {
      where.OR = ${JSON.stringify(cfg.searchFields)}.map((f: string) => ({ [f]: { contains: search, mode: 'insensitive' } }));
    }

    const [items, total] = await Promise.all([
      (db as any).${cfg.model}.findMany({
        where,
        select: { ${cfg.selectFields} },
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
    const created = await (db as any).${cfg.model}.create({ data: { ${cfg.createFields} } });
    await quickAudit(ctx, 'create', '${cfg.model}', created.id, JSON.stringify(d).slice(0, 500));

    ${cfg.trigger ? `// Fire workflow trigger
    if (created.id) {
      try {
        await runWorkflow({
          tenantId: ctx.tenantId!,
          trigger: ${JSON.stringify(cfg.trigger)},
          entityRef: { entity: '${cfg.model}', id: created.id },
          triggerData: { status: created.status, stage: created.stage },
          userId: ctx.session.sub,
        });
      } catch (e) {
        console.error('[workflow] trigger failed', e);
      }
    }` : '// No workflow trigger for this entity'}

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

    // Build update data — only include fields that are actually provided
    const updateData: any = {};
    const provided = Object.fromEntries(Object.entries(d).filter(([k, v]) => v !== undefined));
    // Apply our update mapping (functions handle Date conversion)
    const updateTemplate: any = { ${cfg.updateFields} };
    for (const key of Object.keys(provided)) {
      if (key in updateTemplate && updateTemplate[key] !== undefined) {
        updateData[key] = updateTemplate[key];
      }
    }

    const updated = await (db as any).${cfg.model}.update({ where: { id }, data: updateData });
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
console.log(`Generated ${generated} PostgreSQL-aware CRUD route files.`);
