// OPERA AI — Seed data + initial super admin + plans

import { db } from './db';
import bcrypt from 'bcryptjs';

export async function ensureSeedData() {
  // Plans
  const planCount = await db.plan.count();
  if (planCount === 0) {
    const plans = [
      { name: 'Starter', description: 'For small teams getting started', priceMonthly: 0, priceYearly: 0, trialDays: 7, maxUsers: 3, maxStorageMb: 256, maxAiCalls: 50, featuresCsv: 'crm,tasks,followups,advisor', isDefault: true },
      { name: 'Growth', description: 'For growing businesses', priceMonthly: 149900, priceYearly: 1499900, trialDays: 7, maxUsers: 10, maxStorageMb: 2048, maxAiCalls: 500, featuresCsv: 'crm,tasks,followups,advisor,sales,telecalling,inventory,analytics' },
      { name: 'Business', description: 'For established businesses', priceMonthly: 499900, priceYearly: 4999900, trialDays: 7, maxUsers: 50, maxStorageMb: 10240, maxAiCalls: 2000, featuresCsv: 'crm,tasks,followups,advisor,sales,telecalling,field_sales,hrms,inventory,accounting,marketing,analytics' },
      { name: 'Enterprise', description: 'For large organizations', priceMonthly: 1499900, priceYearly: 14999900, trialDays: 14, maxUsers: 500, maxStorageMb: 51200, maxAiCalls: 10000, featuresCsv: 'crm,tasks,followups,advisor,sales,telecalling,field_sales,hrms,inventory,accounting,marketing,analytics,receptionist,ai_telecaller,custom_workflows' },
    ];
    for (const p of plans) {
      await db.plan.create({ data: p });
    }
  }

  // Super Admin
  const saCount = await db.user.count({ where: { isSuperAdmin: true } });
  if (saCount === 0) {
    const passwordHash = await bcrypt.hash('superadmin123', 10);
    await db.user.create({
      data: {
        email: 'superadmin@opera.ai',
        passwordHash,
        name: 'Super Admin',
        role: 'SUPER_ADMIN',
        isSuperAdmin: true,
        status: 'active',
      },
    });
  }
}
