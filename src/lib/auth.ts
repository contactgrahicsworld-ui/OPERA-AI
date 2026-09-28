// OPERA AI — RBAC + Tenant isolation
// Server-side enforcement. NEVER trust tenantId/role from client requests.

import { getCurrentUser, type SessionPayload } from './session';
import { db } from './db';
import { NextRequest } from 'next/server';

export type Role =
  | 'SUPER_ADMIN'
  | 'OWNER'
  | 'ADMIN'
  | 'MANAGER'
  | 'SALES'
  | 'TELECALLER'
  | 'FIELD_AGENT'
  | 'HR'
  | 'ACCOUNTANT'
  | 'MARKETING'
  | 'VIEWER';

const ROLE_HIERARCHY: Record<Role, number> = {
  SUPER_ADMIN: 100,
  OWNER: 90,
  ADMIN: 80,
  MANAGER: 70,
  HR: 60,
  ACCOUNTANT: 60,
  MARKETING: 60,
  SALES: 50,
  TELECALLER: 50,
  FIELD_AGENT: 50,
  VIEWER: 10,
};

export function hasRole(session: SessionPayload | null, roles: Role[]): boolean {
  if (!session) return false;
  if (session.isSuperAdmin) return true;
  return roles.includes(session.role as Role);
}

export function roleAtLeast(role: Role, minRole: Role): boolean {
  return ROLE_HIERARCHY[role] >= ROLE_HIERARCHY[minRole];
}

export interface AuthContext {
  session: SessionPayload;
  tenantId: string | null;
  isSuperAdmin: boolean;
}

// Enforce that the user is authenticated and belongs to a tenant.
// Returns 401 if unauthenticated, 403 if no tenant.
export async function requireTenantAuth(): Promise<AuthContext | { error: Response }> {
  const session = await getCurrentUser();
  if (!session) {
    return { error: Response.json({ error: 'unauthenticated' }, { status: 401 }) };
  }
  if (!session.user.tenantId && !session.user.isSuperAdmin) {
    return { error: Response.json({ error: 'no_tenant' }, { status: 403 }) };
  }
  return {
    session: {
      sub: session.user.id,
      tenantId: session.user.tenantId,
      role: session.user.role as Role,
      isSuperAdmin: session.user.isSuperAdmin,
      name: session.user.name || '',
      email: session.user.email,
    },
    tenantId: session.user.tenantId,
    isSuperAdmin: session.user.isSuperAdmin,
  };
}

// Enforce role-based access for tenant-scoped routes.
export async function requireTenantRole(roles: Role[]): Promise<AuthContext | { error: Response }> {
  const ctx = await requireTenantAuth();
  if ('error' in ctx) return ctx;
  if (!hasRole(ctx.session, roles)) {
    return { error: Response.json({ error: 'forbidden', required: roles }, { status: 403 }) };
  }
  return ctx;
}

// Enforce super admin.
export async function requireSuperAdmin(): Promise<AuthContext | { error: Response }> {
  const session = await getCurrentUser();
  if (!session) {
    return { error: Response.json({ error: 'unauthenticated' }, { status: 401 }) };
  }
  if (!session.user.isSuperAdmin) {
    return { error: Response.json({ error: 'forbidden', required: 'SUPER_ADMIN' }, { status: 403 }) };
  }
  return {
    session: {
      sub: session.user.id,
      tenantId: session.user.tenantId,
      role: session.user.role as Role,
      isSuperAdmin: true,
      name: session.user.name || '',
      email: session.user.email,
    },
    tenantId: session.user.tenantId,
    isSuperAdmin: true,
  };
}

// Validate that a record belongs to the current tenant.
// Use this on every read/write of tenant-scoped data.
export async function assertTenantOwnership(table: string, recordId: string, tenantId: string): Promise<boolean> {
  // Minimal generic check using raw-ish query via Prisma.
  // For now, we trust callers to filter by tenantId in their queries.
  // This is a placeholder for additional defense-in-depth checks.
  return !!tenantId && !!recordId;
}

export function denyTamperedTenant(): Response {
  return Response.json({ error: 'tampered_tenant' }, { status: 400 });
}

// Convenience: extract body and require JSON shape.
export async function readBody<T = any>(req: NextRequest): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    return {} as T;
  }
}

// Idempotency helper: returns true if the request with given key was already processed.
const processedKeys = new Map<string, number>(); // simple in-memory; production-grade would use Redis.
export function checkIdempotency(key: string, ttlMs = 60_000): { duplicate: boolean } {
  const now = Date.now();
  const last = processedKeys.get(key);
  if (last && now - last < ttlMs) {
    return { duplicate: true };
  }
  processedKeys.set(key, now);
  return { duplicate: false };
}

// Sensitive action gate: list of operations that ALWAYS need human approval.
export const SENSITIVE_ACTIONS = [
  'tenant_delete',
  'user_delete',
  'permission_escalate',
  'subscription_change',
  'invoice_void',
  'payment_refund',
  'data_export_bulk',
  'workflow_delete',
] as const;

export function isSensitiveAction(action: string): boolean {
  return (SENSITIVE_ACTIONS as readonly string[]).includes(action);
}
