// OPERA AI — Seed data + initial platform settings (NO hardcoded super admin)
// Per spec: NO default super admin. First super admin must be created via /api/setup-first-admin.

import { db } from './db';

export async function ensureSeedData() {
  // Plans (if not exist)
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

  // Platform settings (only if not exist)
  const settingsCount = await db.platformSetting.count();
  if (settingsCount === 0) {
    const defaults = [
      { key: 'UPI_RECEIVER', value: '9301056006', description: 'Default UPI receiver for subscription payments (Super Admin controlled)', isSecret: false },
      { key: 'UPI_RECEIVER_NAME', value: 'OPERA AI Operations', description: 'Display name for UPI receiver', isSecret: false },
      { key: 'FIRST_ADMIN_SETUP_DONE', value: 'false', description: 'Set to true after first Super Admin creation; locks the first-time-setup flow permanently', isSecret: false },
      { key: 'WHATSAPP_PROVIDER', value: 'none', description: 'WhatsApp provider (none | twilio | meta | gupshup | interakt). Default none — WhatsApp is CONFIGURATION REQUIRED', isSecret: false },
      { key: 'WHATSAPP_API_TOKEN', value: '', description: 'API token for WhatsApp provider (encrypted at rest)', isSecret: true },
      { key: 'SUPER_ADMIN_WHATSAPP', value: '9301056006', description: 'Super Admin registered WhatsApp for password recovery', isSecret: false },
    ];
    for (const s of defaults) {
      await db.platformSetting.create({ data: s });
    }
  }

  // CRITICAL: NO hardcoded super admin per spec.
  // First super admin must be created via /api/setup-first-admin (locks after first creation).
}
