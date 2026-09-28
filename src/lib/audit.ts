// OPERA AI — Audit logger (server-side)

import { db } from './db';
import type { SessionPayload } from './session';

export async function audit(opts: {
  tenantId: string | null;
  userId?: string;
  action: string;
  entity?: string;
  entityId?: string;
  details?: string;
  ip?: string;
  userAgent?: string;
}) {
  try {
    if (!opts.tenantId) return; // skip platform-level for now (super admin actions)
    await db.auditLog.create({
      data: {
        tenantId: opts.tenantId,
        userId: opts.userId || null,
        action: opts.action,
        entity: opts.entity || '',
        entityId: opts.entityId || '',
        details: opts.details || '',
        ip: opts.ip || '',
        userAgent: opts.userAgent || '',
      },
    });
  } catch (e) {
    // Audit must NEVER break the user flow.
    console.error('[audit]', e);
  }
}

export function extractIp(headers: Headers): string {
  return headers.get('x-forwarded-for') || headers.get('x-real-ip') || '';
}
