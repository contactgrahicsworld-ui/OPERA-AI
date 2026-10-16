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
          productsServices: (d.productsServices ?? (Array.isArray(existing.productsServices) ? existing.productsServices : [])) as any,
          customerSegments: (d.customerSegments ?? (Array.isArray(existing.customerSegments) ? existing.customerSegments : [])) as any,
          salesStages: (d.salesStages ?? (Array.isArray(existing.salesStages) ? existing.salesStages : [])) as any,
          operationalStages: (d.operationalStages ?? (Array.isArray(existing.operationalStages) ? existing.operationalStages : [])) as any,
          departments: (d.departments ?? (Array.isArray(existing.departments) ? existing.departments : [])) as any,
          roles: (d.roles ?? (Array.isArray(existing.roles) ? existing.roles : [])) as any,
          kpis: (d.kpis ?? (Array.isArray(existing.kpis) ? existing.kpis : [])) as any,
          workflowDefs: (d.workflowDefs ?? (Array.isArray(existing.workflowDefs) ? existing.workflowDefs : [])) as any,
          automationOpps: (d.automationOpps ?? (Array.isArray(existing.automationOpps) ? existing.automationOpps : [])) as any,
          aiPriorities: (d.aiPriorities ?? (Array.isArray(existing.aiPriorities) ? existing.aiPriorities : [])) as any,
          customFields: (d.customFields ?? (Array.isArray(existing.customFields) ? existing.customFields : [])) as any,
          terminology: (d.terminology ?? (Array.isArray(existing.terminology) ? existing.terminology : [])) as any,
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
