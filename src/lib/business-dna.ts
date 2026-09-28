// OPERA AI — Business DNA Generator
// Server-side. Builds an industry-agnostic DNA structure from onboarding data.

import { db } from './db';
import { callAI, buildBusinessContext, assertFacts } from './ai';
import { z } from 'zod';

export interface BusinessProfileInput {
  businessName: string;
  businessType: string;
  industry: string;
  products: string;
  services: string;
  customerTypes: string;
  salesProcess: string;
  leadSources: string;
  teamStructure: string;
  departments: string;
  locations: string;
  businessHours: string;
  currency: string;
  taxSettings: string;
  usesInventory: boolean;
  paymentProcess: string;
  followUpProcess: string;
  customWorkflow: string;
}

export const DNA_SCHEMA = z.object({
  industry: z.string(),
  businessModel: z.string(),
  productsServices: z.array(z.string()).default([]),
  customerSegments: z.array(z.string()).default([]),
  salesStages: z.array(z.string()).default(['New', 'Contacted', 'Qualified', 'Won', 'Lost']),
  operationalStages: z.array(z.string()).default([]),
  departments: z.array(z.string()).default([]),
  roles: z.array(z.string()).default([]),
  kpis: z.array(z.string()).default([]),
  workflowDefs: z.array(z.object({
    name: z.string(),
    trigger: z.string(),
    conditions: z.string().default(''),
    actions: z.string().default(''),
  })).default([]),
  automationOpps: z.array(z.string()).default([]),
  aiPriorities: z.array(z.string()).default([]),
  customFields: z.array(z.object({
    entity: z.string(),
    key: z.string(),
    label: z.string(),
    type: z.string().default('text'),
  })).default([]),
  terminology: z.array(z.object({
    term: z.string(),
    meaning: z.string(),
  })).default([]),
});

export async function generateBusinessDNA(profile: BusinessProfileInput, tenantId: string) {
  // Step 1: Try AI-generated DNA
  const prompt = buildAIProfilePrompt(profile);
  const aiRes = await callAI({
    prompt,
    systemPrompt: 'You are an expert business operations analyst. Generate a Business DNA JSON for the user-provided business profile. NEVER invent facts not supported by the inputs. If unsure, return a minimal valid structure.',
    outputSchema: DNA_SCHEMA,
    temperature: 0.4,
    maxTokens: 2200,
  }, { tenantId, feature: 'business_dna' });

  let dna: z.infer<typeof DNA_SCHEMA>;
  if (aiRes.ok && aiRes.data) {
    dna = aiRes.data as z.infer<typeof DNA_SCHEMA>;
  } else {
    // Fallback: deterministic DNA from inputs (no AI dependency)
    dna = buildFallbackDNA(profile);
  }

  // Step 2: Persist DNA
  const existing = await db.businessDNA.findUnique({ where: { tenantId } });
  if (existing) {
    return await db.businessDNA.update({
      where: { tenantId },
      data: {
        industry: dna.industry || profile.industry,
        businessModel: dna.businessModel || 'B2B Service',
        productsServices: JSON.stringify(dna.productsServices || []),
        customerSegments: JSON.stringify(dna.customerSegments || []),
        salesStages: JSON.stringify(dna.salesStages || []),
        operationalStages: JSON.stringify(dna.operationalStages || []),
        departments: JSON.stringify(dna.departments || []),
        roles: JSON.stringify(dna.roles || []),
        kpis: JSON.stringify(dna.kpis || []),
        workflowDefs: JSON.stringify(dna.workflowDefs || []),
        automationOpps: JSON.stringify(dna.automationOpps || []),
        aiPriorities: JSON.stringify(dna.aiPriorities || []),
        customFields: JSON.stringify(dna.customFields || []),
        terminology: JSON.stringify(dna.terminology || []),
        generatedBy: aiRes.ok ? 'ai' : 'manual',
        version: { increment: 1 },
        updatedAt: new Date(),
      },
    });
  }
  return await db.businessDNA.create({
    data: {
      tenantId,
      industry: dna.industry || profile.industry,
      businessModel: dna.businessModel || 'B2B Service',
      productsServices: JSON.stringify(dna.productsServices || []),
      customerSegments: JSON.stringify(dna.customerSegments || []),
      salesStages: JSON.stringify(dna.salesStages || []),
      operationalStages: JSON.stringify(dna.operationalStages || []),
      departments: JSON.stringify(dna.departments || []),
      roles: JSON.stringify(dna.roles || []),
      kpis: JSON.stringify(dna.kpis || []),
      workflowDefs: JSON.stringify(dna.workflowDefs || []),
      automationOpps: JSON.stringify(dna.automationOpps || []),
      aiPriorities: JSON.stringify(dna.aiPriorities || []),
      customFields: JSON.stringify(dna.customFields || []),
      terminology: JSON.stringify(dna.terminology || []),
      generatedBy: aiRes.ok ? 'ai' : 'manual',
      version: 1,
    },
  });
}

function buildAIProfilePrompt(p: BusinessProfileInput): string {
  return `${assertFacts('Generate a Business DNA for this business.')}

Business name: ${p.businessName}
Type: ${p.businessType}
Industry: ${p.industry}
Products: ${p.products || 'n/a'}
Services: ${p.services || 'n/a'}
Customer types: ${p.customerTypes || 'n/a'}
Sales process: ${p.salesProcess || 'n/a'}
Lead sources: ${p.leadSources || 'n/a'}
Team structure: ${p.teamStructure || 'n/a'}
Departments: ${p.departments || 'n/a'}
Locations: ${p.locations || 'n/a'}
Business hours: ${p.businessHours || 'n/a'}
Currency: ${p.currency || 'INR'}
Tax settings: ${p.taxSettings || 'standard'}
Uses inventory: ${p.usesInventory ? 'yes' : 'no'}
Payment process: ${p.paymentProcess || 'n/a'}
Follow-up process: ${p.followUpProcess || 'n/a'}
Custom workflow notes: ${p.customWorkflow || 'n/a'}

Return JSON with keys:
industry, businessModel, productsServices[], customerSegments[], salesStages[], operationalStages[], departments[], roles[], kpis[], workflowDefs[{name,trigger,conditions,actions}], automationOpps[], aiPriorities[], customFields[{entity,key,label,type}], terminology[{term,meaning}].
Keep all fields concise and grounded in the inputs above.`;
}

function buildFallbackDNA(p: BusinessProfileInput): z.infer<typeof DNA_SCHEMA> {
  const depts = p.departments
    ? p.departments.split(/[,|\n]/).map((s) => s.trim()).filter(Boolean)
    : ['Sales', 'Operations', 'Finance'];
  const products = p.products
    ? p.products.split(/[,|\n]/).map((s) => s.trim()).filter(Boolean)
    : [];
  const services = p.services
    ? p.services.split(/[,|\n]/).map((s) => s.trim()).filter(Boolean)
    : [];
  const customerSegments = p.customerTypes
    ? p.customerTypes.split(/[,|\n]/).map((s) => s.trim()).filter(Boolean)
    : ['B2B', 'B2C'];
  const salesStages = p.salesProcess
    ? p.salesProcess.split(/[→>|,\n]/).map((s) => s.trim()).filter(Boolean)
    : ['New', 'Contacted', 'Qualified', 'Won', 'Lost'];

  return {
    industry: p.industry || 'General',
    businessModel: p.businessType || 'Service',
    productsServices: [...products, ...services],
    customerSegments,
    salesStages,
    operationalStages: ['Lead', 'Customer', 'Fulfilment', 'Collection', 'Support'],
    departments: depts,
    roles: ['Owner', 'Salesperson', 'Telecaller', 'Field Agent', 'Accountant', 'HR'],
    kpis: ['Revenue', 'Lead Conversion', 'Customer Retention', 'Quotation Acceptance', 'Collection Ratio'],
    workflowDefs: [
      {
        name: 'New Lead Assignment',
        trigger: 'new_lead',
        conditions: 'stage=New',
        actions: 'assign_owner, create_followup, notify_owner',
      },
      {
        name: 'Quotation Inactive',
        trigger: 'quotation_inactive',
        conditions: 'days_inactive>=3',
        actions: 'create_followup, notify_salesperson',
      },
      {
        name: 'Payment Overdue',
        trigger: 'payment_overdue',
        conditions: 'due_date<today',
        actions: 'create_collection_task, notify_owner',
      },
      {
        name: 'Low Stock',
        trigger: 'low_stock',
        conditions: 'quantity<=reorder_level',
        actions: 'create_purchase_recommendation',
      },
      {
        name: 'Customer Inactive',
        trigger: 'customer_inactive',
        conditions: 'days_inactive>=30',
        actions: 'ai_reengagement_recommendation',
      },
    ],
    automationOpps: [
      'Auto-assign leads by round-robin or product line',
      'Auto-create follow-up after quotation sent',
      'Auto-flag overdue payments',
      'Auto-recommend restock when below threshold',
    ],
    aiPriorities: [
      'Identify leads needing follow-up',
      'Flag quotations at risk of going stale',
      'Flag overdue payments',
      'Recommend re-engagement for inactive customers',
    ],
    customFields: [],
    terminology: [],
  };
}

// Loader used by AI features.
export async function getBusinessDNA(tenantId: string) {
  const dna = await db.businessDNA.findUnique({ where: { tenantId } });
  if (!dna) return null;
  return {
    industry: dna.industry,
    businessModel: dna.businessModel,
    productsServices: safeParseArray(dna.productsServices),
    customerSegments: safeParseArray(dna.customerSegments),
    salesStages: safeParseArray(dna.salesStages),
    operationalStages: safeParseArray(dna.operationalStages),
    departments: safeParseArray(dna.departments),
    roles: safeParseArray(dna.roles),
    kpis: safeParseArray(dna.kpis),
    workflowDefs: safeParseArray(dna.workflowDefs),
    automationOpps: safeParseArray(dna.automationOpps),
    aiPriorities: safeParseArray(dna.aiPriorities),
    customFields: safeParseArray(dna.customFields),
    terminology: safeParseArray(dna.terminology),
  };
}

export function safeParseArray(s: string | null | undefined): any[] {
  if (!s) return [];
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}
