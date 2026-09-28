// Shared helpers for API routes
import { NextRequest, NextResponse } from 'next/server';
import { requireTenantAuth, requireTenantRole, requireSuperAdmin, type AuthContext, type Role } from '@/lib/auth';
import { audit, extractIp } from '@/lib/audit';

// Wrap a tenant-scoped GET handler
export async function withTenant<T>(
  req: NextRequest,
  handler: (ctx: AuthContext) => Promise<T>
): Promise<Response> {
  const ctx = await requireTenantAuth();
  if ('error' in ctx) return ctx.error;
  try {
    const result = await handler(ctx);
    return NextResponse.json(result);
  } catch (e) {
    console.error('[api]', e);
    return NextResponse.json({ error: 'server_error', message: (e as Error).message }, { status: 500 });
  }
}

// Wrap a tenant-scoped handler with role restriction
export async function withRole<T>(
  req: NextRequest,
  roles: Role[],
  handler: (ctx: AuthContext) => Promise<T>
): Promise<Response> {
  const ctx = await requireTenantRole(roles);
  if ('error' in ctx) return ctx.error;
  try {
    const result = await handler(ctx);
    return NextResponse.json(result);
  } catch (e) {
    console.error('[api]', e);
    return NextResponse.json({ error: 'server_error', message: (e as Error).message }, { status: 500 });
  }
}

// Wrap a super-admin-only handler
export async function withSuperAdmin<T>(
  req: NextRequest,
  handler: (ctx: AuthContext) => Promise<T>
): Promise<Response> {
  const ctx = await requireSuperAdmin();
  if ('error' in ctx) return ctx.error;
  try {
    const result = await handler(ctx);
    return NextResponse.json(result);
  } catch (e) {
    console.error('[api]', e);
    return NextResponse.json({ error: 'server_error', message: (e as Error).message }, { status: 500 });
  }
}

// Helper to extract query params safely
export function qp(req: NextRequest, key: string, def = ''): string {
  return new URL(req.url).searchParams.get(key) || def;
}

// Audit shortcut
export async function quickAudit(ctx: AuthContext, action: string, entity: string, entityId: string, details = '') {
  await audit({
    tenantId: ctx.tenantId,
    userId: ctx.session.sub,
    action,
    entity,
    entityId,
    details,
  });
}

export { extractIp };
