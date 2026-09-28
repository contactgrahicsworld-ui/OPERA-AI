// Auth: signup (creates tenant + owner), login, logout, me
import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { db } from '@/lib/db';
import { setSessionCookie, clearSessionCookie, getSession } from '@/lib/session';
import { ensureSeedData } from '@/lib/seed';
import { audit, extractIp } from '@/lib/audit';
import { DEFAULT_WORKFLOWS } from '@/lib/workflow';
import { generateBusinessDNA, type BusinessProfileInput } from '@/lib/business-dna';
import { z } from 'zod';

const SIGNUP_SCHEMA = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(1),
  businessName: z.string().min(1),
  businessType: z.string().optional(),
  industry: z.string().optional(),
  products: z.string().optional(),
  services: z.string().optional(),
  customerTypes: z.string().optional(),
  salesProcess: z.string().optional(),
  leadSources: z.string().optional(),
  teamStructure: z.string().optional(),
  departments: z.string().optional(),
  locations: z.string().optional(),
  businessHours: z.string().optional(),
  currency: z.string().default('INR'),
  taxSettings: z.string().optional(),
  usesInventory: z.boolean().default(false),
  paymentProcess: z.string().optional(),
  followUpProcess: z.string().optional(),
  customWorkflow: z.string().optional(),
});

const LOGIN_SCHEMA = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const path = new URL(req.url).searchParams.get('action') || 'signup';

  if (path === 'signup') {
    const parsed = SIGNUP_SCHEMA.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'invalid_input', details: parsed.error.flatten() }, { status: 400 });
    }
    const d = parsed.data;

    const existing = await db.user.findUnique({ where: { email: d.email } });
    if (existing) {
      return NextResponse.json({ error: 'email_taken' }, { status: 409 });
    }

    await ensureSeedData();

    const slugBase = (d.businessName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'business').slice(0, 50);
    let slug = slugBase;
    let suffix = 1;
    while (await db.tenant.findUnique({ where: { slug } })) {
      slug = `${slugBase}-${suffix++}`;
    }

    const trialPlan = await db.plan.findFirst({ where: { name: 'Starter' } });
    const trialEndsAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const tenant = await db.tenant.create({
      data: {
        name: d.businessName,
        slug,
        status: 'trial',
        planId: trialPlan?.id,
        trialEndsAt,
      },
    });

    if (trialPlan) {
      await db.subscription.create({
        data: {
          tenantId: tenant.id,
          planId: trialPlan.id,
          status: 'trial',
          startedAt: new Date(),
          endsAt: trialEndsAt,
          billingCycle: 'monthly',
        },
      });
    }

    const passwordHash = await bcrypt.hash(d.password, 10);
    const user = await db.user.create({
      data: {
        email: d.email,
        passwordHash,
        name: d.name,
        role: 'OWNER',
        tenantId: tenant.id,
        status: 'active',
      },
    });

    const profileInput: BusinessProfileInput = {
      businessName: d.businessName,
      businessType: d.businessType || '',
      industry: d.industry || '',
      products: d.products || '',
      services: d.services || '',
      customerTypes: d.customerTypes || '',
      salesProcess: d.salesProcess || '',
      leadSources: d.leadSources || '',
      teamStructure: d.teamStructure || '',
      departments: d.departments || '',
      locations: d.locations || '',
      businessHours: d.businessHours || '',
      currency: d.currency || 'INR',
      taxSettings: d.taxSettings || '{}',
      usesInventory: d.usesInventory,
      paymentProcess: d.paymentProcess || '',
      followUpProcess: d.followUpProcess || '',
      customWorkflow: d.customWorkflow || '',
    };

    await db.businessProfile.create({
      data: {
        tenantId: tenant.id,
        businessName: d.businessName,
        businessType: d.businessType || '',
        industry: d.industry || '',
        productsCsv: d.products || '',
        servicesCsv: d.services || '',
        customerTypes: d.customerTypes || '',
        salesProcess: d.salesProcess || '',
        leadSources: d.leadSources || '',
        teamStructure: d.teamStructure || '',
        departments: d.departments || '',
        locations: d.locations || '',
        businessHours: d.businessHours || '',
        currency: d.currency || 'INR',
        taxSettings: d.taxSettings || '{}',
        usesInventory: d.usesInventory,
        paymentProcess: d.paymentProcess || '',
        followUpProcess: d.followUpProcess || '',
        customWorkflow: d.customWorkflow || '',
      },
    });

    try {
      await generateBusinessDNA(profileInput, tenant.id);
    } catch (e) {
      console.error('[signup] DNA generation failed', e);
    }

    for (const w of DEFAULT_WORKFLOWS) {
      await db.automation.create({
        data: {
          tenantId: tenant.id,
          name: w.name,
          trigger: w.trigger,
          conditions: w.conditions,
          actions: w.actions,
          requiresApproval: w.requiresApproval,
          isActive: true,
        },
      }).catch(() => {});
    }

    await db.pipeline.create({
      data: {
        tenantId: tenant.id,
        name: 'Default Lead Pipeline',
        entity: 'lead',
        stagesCsv: 'New,Contacted,Qualified,Won,Lost',
        isDefault: true,
      },
    }).catch(() => {});
    await db.pipeline.create({
      data: {
        tenantId: tenant.id,
        name: 'Default Deal Pipeline',
        entity: 'deal',
        stagesCsv: 'New,Qualified,Proposal,Negotiation,Won,Lost',
        isDefault: true,
      },
    }).catch(() => {});

    await db.leadSource.create({
      data: { tenantId: tenant.id, name: 'Manual', type: 'manual', isActive: true },
    }).catch(() => {});

    await setSessionCookie({
      sub: user.id,
      tenantId: tenant.id,
      role: user.role,
      isSuperAdmin: false,
      name: user.name || '',
      email: user.email,
    });

    await audit({
      tenantId: tenant.id,
      userId: user.id,
      action: 'signup',
      entity: 'tenant',
      entityId: tenant.id,
      ip: extractIp(req.headers),
      userAgent: req.headers.get('user-agent') || '',
      details: `business=${d.businessName}`,
    });

    return NextResponse.json({ ok: true, tenantId: tenant.id, userId: user.id });
  }

  if (path === 'login') {
    const parsed = LOGIN_SCHEMA.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'invalid_input' }, { status: 400 });
    }
    const { email, password } = parsed.data;
    const user = await db.user.findUnique({ where: { email } });
    if (!user) {
      return NextResponse.json({ error: 'invalid_credentials' }, { status: 401 });
    }
    if (user.status !== 'active') {
      return NextResponse.json({ error: 'inactive_account' }, { status: 403 });
    }
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      return NextResponse.json({ error: 'invalid_credentials' }, { status: 401 });
    }

    await setSessionCookie({
      sub: user.id,
      tenantId: user.tenantId,
      role: user.role,
      isSuperAdmin: user.isSuperAdmin,
      name: user.name || '',
      email: user.email,
    });

    if (user.tenantId) {
      await audit({
        tenantId: user.tenantId,
        userId: user.id,
        action: 'login',
        ip: extractIp(req.headers),
        userAgent: req.headers.get('user-agent') || '',
      });
    }

    return NextResponse.json({ ok: true, isSuperAdmin: user.isSuperAdmin, tenantId: user.tenantId });
  }

  if (path === 'logout') {
    const sess = await getSession();
    if (sess?.tenantId) {
      await audit({
        tenantId: sess.tenantId,
        userId: sess.sub,
        action: 'logout',
        ip: extractIp(req.headers),
        userAgent: req.headers.get('user-agent') || '',
      });
    }
    await clearSessionCookie();
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'unknown_action' }, { status: 400 });
}

export async function GET() {
  const sess = await getSession();
  if (!sess) {
    return NextResponse.json({ authenticated: false });
  }
  const user = await db.user.findUnique({
    where: { id: sess.sub },
    select: { id: true, email: true, name: true, role: true, isSuperAdmin: true, tenantId: true, status: true },
  });
  if (!user) {
    return NextResponse.json({ authenticated: false });
  }
  const tenant = user.tenantId
    ? await db.tenant.findUnique({ where: { id: user.tenantId }, select: { id: true, name: true, slug: true, status: true } })
    : null;
  const subscription = user.tenantId
    ? await db.subscription.findFirst({ where: { tenantId: user.tenantId }, include: { plan: true } })
    : null;
  return NextResponse.json({
    authenticated: true,
    user,
    tenant,
    subscription: subscription ? { status: subscription.status, plan: subscription.plan.name, endsAt: subscription.endsAt } : null,
  });
}
