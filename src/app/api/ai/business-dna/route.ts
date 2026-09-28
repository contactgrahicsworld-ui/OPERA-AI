// OPERA AI — Get / regenerate Business DNA
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { withTenant, qp, quickAudit, type AuthContext } from '@/lib/api-helpers';
import { getBusinessDNA, generateBusinessDNA, type BusinessProfileInput } from '@/lib/business-dna';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  return withTenant(req, async (ctx: AuthContext) => {
    const dna = await getBusinessDNA(ctx.tenantId!);
    const profile = await db.businessProfile.findUnique({ where: { tenantId: ctx.tenantId! } });
    return { dna, profile };
  });
}

export async function POST(req: NextRequest) {
  return withTenant(req, async (ctx: AuthContext) => {
    const op = qp(req, 'op', 'regenerate');
    if (op === 'regenerate') {
      const profile = await db.businessProfile.findUnique({ where: { tenantId: ctx.tenantId! } });
      if (!profile) return { error: 'no_profile' };
      const input: BusinessProfileInput = {
        businessName: profile.businessName,
        businessType: profile.businessType,
        industry: profile.industry,
        products: profile.productsCsv,
        services: profile.servicesCsv,
        customerTypes: profile.customerTypes,
        salesProcess: profile.salesProcess,
        leadSources: profile.leadSources,
        teamStructure: profile.teamStructure,
        departments: profile.departments,
        locations: profile.locations,
        businessHours: profile.businessHours,
        currency: profile.currency,
        taxSettings: profile.taxSettings,
        usesInventory: profile.usesInventory,
        paymentProcess: profile.paymentProcess,
        followUpProcess: profile.followUpProcess,
        customWorkflow: profile.customWorkflow,
      };
      const dna = await generateBusinessDNA(input, ctx.tenantId!);
      await quickAudit(ctx, 'regenerate_dna', 'businessDNA', dna.id);
      return { ok: true, id: dna.id };
    }
    if (op === 'update') {
      const d = await req.json().catch(() => ({}));
      const existing = await db.businessDNA.findUnique({ where: { tenantId: ctx.tenantId! } });
      if (!existing) return { error: 'no_dna' };
      const updated = await db.businessDNA.update({
        where: { tenantId: ctx.tenantId! },
        data: {
          industry: d.industry ?? existing.industry,
          businessModel: d.businessModel ?? existing.businessModel,
          productsServices: JSON.stringify(d.productsServices ?? JSON.parse(existing.productsServices || '[]')),
          customerSegments: JSON.stringify(d.customerSegments ?? JSON.parse(existing.customerSegments || '[]')),
          salesStages: JSON.stringify(d.salesStages ?? JSON.parse(existing.salesStages || '[]')),
          operationalStages: JSON.stringify(d.operationalStages ?? JSON.parse(existing.operationalStages || '[]')),
          departments: JSON.stringify(d.departments ?? JSON.parse(existing.departments || '[]')),
          roles: JSON.stringify(d.roles ?? JSON.parse(existing.roles || '[]')),
          kpis: JSON.stringify(d.kpis ?? JSON.parse(existing.kpis || '[]')),
          workflowDefs: JSON.stringify(d.workflowDefs ?? JSON.parse(existing.workflowDefs || '[]')),
          automationOpps: JSON.stringify(d.automationOpps ?? JSON.parse(existing.automationOpps || '[]')),
          aiPriorities: JSON.stringify(d.aiPriorities ?? JSON.parse(existing.aiPriorities || '[]')),
          customFields: JSON.stringify(d.customFields ?? JSON.parse(existing.customFields || '[]')),
          terminology: JSON.stringify(d.terminology ?? JSON.parse(existing.terminology || '[]')),
          generatedBy: 'manual',
          version: { increment: 1 },
          updatedAt: new Date(),
        },
      });
      await quickAudit(ctx, 'update_dna', 'businessDNA', updated.id);
      return { ok: true, id: updated.id };
    }
    return { error: 'unknown_op' };
  });
}
