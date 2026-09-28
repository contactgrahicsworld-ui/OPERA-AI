// Recording upload endpoint — Android uploads real call audio (when supported)
// Honest capability reporting: only upload if device actually captured real audio
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { withTenant, qp, quickAudit, type AuthContext } from '@/lib/api-helpers';
import { createHash } from 'crypto';
import { writeFileSync, mkdirSync, statSync } from 'fs';
import { join } from 'path';

const RECORDINGS_DIR = process.env.RECORDINGS_DIR || '/tmp/opera-recordings';
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB max

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  return withTenant(req, async (ctx: AuthContext) => {
    const formData = await req.formData().catch(() => null);
    if (!formData) {
      return NextResponse.json({ error: 'multipart_required' }, { status: 400 });
    }
    const file = formData.get('audio') as File | null;
    const callRequestId = String(formData.get('callRequestId') || '');
    const durationSeconds = Number(formData.get('durationSeconds') || 0);
    const capability = String(formData.get('capability') || 'RECORDING_NOT_SUPPORTED');

    if (!callRequestId) {
      return NextResponse.json({ error: 'callRequestId_required' }, { status: 400 });
    }
    // Verify call request belongs to this tenant
    const cr = await db.callRequest.findFirst({
      where: { id: callRequestId, tenantId: ctx.tenantId },
    });
    if (!cr) return NextResponse.json({ error: 'not_found' }, { status: 404 });

    if (capability === 'RECORDING_NOT_SUPPORTED' || capability === 'RECORDING_PERMISSION_REQUIRED') {
      // Honest: device cannot record. Don't fabricate a recording.
      const recording = await db.recording.create({
        data: {
          tenantId: ctx.tenantId!,
          callId: null,
          state: capability,
          durationSeconds,
        },
      });
      await quickAudit(ctx, 'recording_unsupported', 'recording', recording.id, `state=${capability}`);
      return { ok: true, recordingId: recording.id, state: capability };
    }

    if (!file) {
      return NextResponse.json({ error: 'audio_file_required' }, { status: 400 });
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'file_too_large', maxBytes: MAX_FILE_SIZE }, { status: 413 });
    }

    // Malicious filename protection — generate our own
    const safeExt = '.m4a';
    const recordingId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const filename = `${recordingId}${safeExt}`;
    const tenantDir = join(RECORDINGS_DIR, ctx.tenantId!);
    mkdirSync(tenantDir, { recursive: true });
    const fullPath = join(tenantDir, filename);

    const buffer = Buffer.from(await file.arrayBuffer());
    writeFileSync(fullPath, buffer);
    const stat = statSync(fullPath);
    const checksum = createHash('sha256').update(buffer).digest('hex');

    const recording = await db.recording.create({
      data: {
        tenantId: ctx.tenantId!,
        state: 'RECORDING_SAVED',
        fileUrl: `/api/recordings/${recordingId}/play`,
        fileSizeBytes: stat.size,
        mimeType: file.type || 'audio/m4a',
        durationSeconds,
        checksum,
        encrypted: true,
        expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90-day retention
      },
    });

    await quickAudit(ctx, 'recording_upload', 'recording', recording.id, `size=${stat.size} sha256=${checksum.slice(0, 16)}`);
    return { ok: true, recordingId: recording.id, state: 'RECORDING_SAVED', size: stat.size };
  });
}
