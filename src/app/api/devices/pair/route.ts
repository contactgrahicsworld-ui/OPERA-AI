// Device pairing — generates a one-time pairing code
// The Android app enters the code, then the device is registered + awaiting owner approval
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { withTenant, quickAudit, type AuthContext } from '@/lib/api-helpers';
import { randomUUID } from 'crypto';

export const dynamic = 'force-dynamic';

// POST: generate a fresh pairing code (owner invokes this from the web app)
export async function POST(req: NextRequest) {
  return withTenant(req, async (ctx: AuthContext) => {
    const body = await req.json().catch(() => ({}));
    const deviceName = (body.deviceName || 'Android Device').slice(0, 100);
    const pairingCode = randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase();
    const device = await db.device.create({
      data: {
        tenantId: ctx.tenantId!,
        userId: ctx.session.sub,
        deviceName,
        pairingCode,
        isApproved: false,
        isRevoked: false,
        healthStatus: 'unknown',
      },
    });
    await quickAudit(ctx, 'device_pair_init', 'device', device.id, `code=${pairingCode}`);
    return { ok: true, deviceId: device.id, pairingCode, expiresInSeconds: 600 };
  });
}

// GET: list devices for this tenant
export async function GET(req: NextRequest) {
  return withTenant(req, async (ctx: AuthContext) => {
    const items = await db.device.findMany({
      where: { tenantId: ctx.tenantId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        deviceName: true,
        deviceModel: true,
        androidVersion: true,
        isApproved: true,
        isRevoked: true,
        lastHeartbeatAt: true,
        healthStatus: true,
        createdAt: true,
      },
    });
    return { items };
  });
}
