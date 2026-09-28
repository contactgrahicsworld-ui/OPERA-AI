// OPERA AI — Team users (within a tenant)
import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { db } from '@/lib/db';
import { withTenant, qp, quickAudit, type AuthContext } from '@/lib/api-helpers';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  return withTenant(req, async (ctx: AuthContext) => {
    const items = await db.user.findMany({
      where: { tenantId: ctx.tenantId },
      select: { id: true, email: true, name: true, role: true, status: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
    return { items };
  });
}

export async function POST(req: NextRequest) {
  return withTenant(req, async (ctx: AuthContext) => {
    const op = qp(req, 'op', 'invite');
    const body = await req.json().catch(() => ({}));
    if (op === 'invite') {
      const { email, name, role, password } = body;
      if (!email || !role || !password) return NextResponse.json({ error: 'missing_fields' }, { status: 400 });
      const existing = await db.user.findUnique({ where: { email } });
      if (existing) return NextResponse.json({ error: 'email_taken' }, { status: 409 });
      const passwordHash = await bcrypt.hash(password, 10);
      const user = await db.user.create({
        data: { email, name: name || '', role, passwordHash, tenantId: ctx.tenantId, status: 'active' },
      });
      await quickAudit(ctx, 'invite_user', 'user', user.id, `role=${role}`);
      return { ok: true, id: user.id };
    }
    if (op === 'update_role') {
      const { userId, role } = body;
      if (!userId || !role) return { error: 'missing_fields' };
      // cannot escalate yourself to super admin via this path
      if (role === 'SUPER_ADMIN') return { error: 'forbidden' };
      const target = await db.user.findFirst({ where: { id: userId, tenantId: ctx.tenantId } });
      if (!target) return { error: 'not_found' };
      const updated = await db.user.update({ where: { id: userId }, data: { role } });
      await quickAudit(ctx, 'update_role', 'user', userId, `role=${role}`);
      return { ok: true };
    }
    if (op === 'deactivate') {
      const { userId } = body;
      if (!userId) return { error: 'missing_fields' };
      const target = await db.user.findFirst({ where: { id: userId, tenantId: ctx.tenantId } });
      if (!target) return { error: 'not_found' };
      if (target.role === 'OWNER') return { error: 'cannot_deactivate_owner' };
      const updated = await db.user.update({ where: { id: userId }, data: { status: 'inactive' } });
      await quickAudit(ctx, 'deactivate_user', 'user', userId);
      return { ok: true };
    }
    return { error: 'unknown_op' };
  });
}
