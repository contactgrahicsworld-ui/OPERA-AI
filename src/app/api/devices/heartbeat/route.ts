// Device pairing completion + heartbeat from Android
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { withTenant, quickAudit, type AuthContext } from '@/lib/api-helpers';
import { z } from 'zod';

const COMPLETE_SCHEMA = z.object({
  pairingCode: z.string().min(8).max(8),
  deviceModel: z.string().max(200).default(''),
  androidVersion: z.string().max(50).default(''),
  fcmToken: z.string().max(500).optional(),
});

const HEARTBEAT_SCHEMA = z.object({
  deviceId: z.string(),
  healthStatus: z.enum(['healthy', 'degraded', 'offline']).default('healthy'),
});

export const dynamic = 'force-dynamic';

// POST: pairing completion (called by Android after user enters code) OR heartbeat
export async function POST(req: NextRequest) {
  const op = new URL(req.url).searchParams.get('op') || 'complete';
  if (op === 'complete') {
    return withTenant(req, async (ctx: AuthContext) => {
      const body = await req.json().catch(() => ({}));
      const parsed = COMPLETE_SCHEMA.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: 'invalid_input', details: parsed.error.flatten() }, { status: 400 });
      }
      const d = parsed.data;
      const device = await db.device.findFirst({
        where: { tenantId: ctx.tenantId, pairingCode: d.pairingCode, isApproved: false, isRevoked: false },
      });
      if (!device) {
        return NextResponse.json({ error: 'invalid_pairing_code' }, { status: 404 });
      }
      // Save device info, but device is NOT yet approved — owner must approve
      const updated = await db.device.update({
        where: { id: device.id },
        data: {
          deviceModel: d.deviceModel,
          androidVersion: d.androidVersion,
          fcmToken: d.fcmToken,
          lastHeartbeatAt: new Date(),
          healthStatus: 'healthy',
        },
      });
      await quickAudit(ctx, 'device_pair_complete', 'device', device.id, `model=${d.deviceModel}`);
      return { ok: true, deviceId: device.id, awaitingApproval: true };
    });
  }
  if (op === 'approve') {
    return withTenant(req, async (ctx: AuthContext) => {
      const { deviceId } = await req.json().catch(() => ({}));
      if (!deviceId) return NextResponse.json({ error: 'deviceId_required' }, { status: 400 });
      const device = await db.device.findFirst({ where: { id: deviceId, tenantId: ctx.tenantId } });
      if (!device) return NextResponse.json({ error: 'not_found' }, { status: 404 });
      const updated = await db.device.update({ where: { id: deviceId }, data: { isApproved: true, isRevoked: false } });
      await quickAudit(ctx, 'device_approve', 'device', deviceId);
      return { ok: true };
    });
  }
  if (op === 'revoke') {
    return withTenant(req, async (ctx: AuthContext) => {
      const { deviceId } = await req.json().catch(() => ({}));
      if (!deviceId) return NextResponse.json({ error: 'deviceId_required' }, { status: 400 });
      const device = await db.device.findFirst({ where: { id: deviceId, tenantId: ctx.tenantId } });
      if (!device) return NextResponse.json({ error: 'not_found' }, { status: 404 });
      await db.device.update({ where: { id: deviceId }, data: { isRevoked: true, isApproved: false } });
      await quickAudit(ctx, 'device_revoke', 'device', deviceId);
      return { ok: true };
    });
  }
  if (op === 'heartbeat') {
    return withTenant(req, async (ctx: AuthContext) => {
      const body = await req.json().catch(() => ({}));
      const parsed = HEARTBEAT_SCHEMA.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: 'invalid_input' }, { status: 400 });
      }
      const d = parsed.data;
      const device = await db.device.findFirst({
        where: { id: d.deviceId, tenantId: ctx.tenantId, isApproved: true, isRevoked: false },
      });
      if (!device) return NextResponse.json({ error: 'not_found_or_not_approved' }, { status: 404 });
      await db.device.update({
        where: { id: d.deviceId },
        data: { lastHeartbeatAt: new Date(), healthStatus: d.healthStatus },
      });
      return { ok: true };
    });
  }
  return NextResponse.json({ error: 'unknown_op' }, { status: 400 });
}
