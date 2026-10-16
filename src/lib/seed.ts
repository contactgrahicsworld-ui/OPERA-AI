// OPERA AI — Seed data (NO hardcoded credentials)
// Per spec: NO default super admin, NO hardcoded UPI receiver, NO hardcoded WhatsApp.
// First super admin must be created via /api/setup-first-admin.
// UPI receiver + WhatsApp must be set by super admin via UI after first-admin setup.

import { db } from './db';

export async function ensureSeedData() {
  // Plans (if not exist) — these are TEMPLATES, not credentials.
  // Super Admin can edit/delete/create new plans via /api/super-admin/plans.
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

  // Platform settings — NO hardcoded credentials. Empty values for super admin to fill in.
  const settingsCount = await db.platformSetting.count();
  if (settingsCount === 0) {
    const defaults = [
      // UPI_RECEIVER is intentionally empty — super admin must set via /api/super-admin/upi-receiver
      { key: 'UPI_RECEIVER', value: '', description: 'UPI receiver for subscription payments. Set by Super Admin after first-admin setup. NO hardcoded default.', isSecret: false },
      { key: 'UPI_RECEIVER_NAME', value: '', description: 'Display name for UPI receiver. Set by Super Admin.', isSecret: false },
      { key: 'FIRST_ADMIN_SETUP_DONE', value: 'false', description: 'Set to true after first Super Admin creation; locks the first-time-setup flow permanently', isSecret: false },
      { key: 'WHATSAPP_PROVIDER', value: 'none', description: 'WhatsApp provider (none | twilio | meta | gupshup | interakt). Default none — WhatsApp is CONFIGURATION REQUIRED', isSecret: false },
      { key: 'WHATSAPP_API_TOKEN', value: '', description: 'API token for WhatsApp provider (encrypted at rest)', isSecret: true },
      // SUPER_ADMIN_WHATSAPP is intentionally empty — set during first-admin setup from user input
      { key: 'SUPER_ADMIN_WHATSAPP', value: '', description: 'Super Admin registered WhatsApp for password recovery. Set during first-admin setup. NO hardcoded default.', isSecret: false },
      { key: 'SUPER_ADMIN_EMAIL', value: '', description: 'Primary super admin email. Set during first-admin setup. NO hardcoded default.', isSecret: false },
    ];
    for (const s of defaults) {
      await db.platformSetting.create({ data: s });
    }
  }

  // CRITICAL: NO hardcoded super admin per spec.
  // First super admin must be created via /api/setup-first-admin (locks after first creation).
  // The setup requires FIRST_ADMIN_SETUP_KEY env var (deployer-controlled secret).
}
