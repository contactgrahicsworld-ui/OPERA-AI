// AI Telecaller — call preparation + script generation + call summary
// Per spec: customer context, call preparation, scripts, objection handling,
// call summaries, follow-up recommendations, Indian-language support architecture
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { withTenant, qp, type AuthContext } from '@/lib/api-helpers';
import { callAI, buildBusinessContext, assertFacts } from '@/lib/ai';
import { getBusinessDNA } from '@/lib/business-dna';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

// GET: fetch call preparation context + suggested script for a lead
export async function GET(req: NextRequest) {
  return withTenant(req, async (ctx: AuthContext) => {
    const leadId = qp(req, 'leadId');
    if (!leadId) return NextResponse.json({ error: 'leadId_required' }, { status: 400 });

    const lead = await db.lead.findFirst({ where: { id: leadId, tenantId: ctx.tenantId } });
    if (!lead) return NextResponse.json({ error: 'lead_not_found' }, { status: 404 });

    // Fetch lead's previous interactions
    const [previousCalls, followUps, notes] = await Promise.all([
      db.call.findMany({ where: { leadId, tenantId: ctx.tenantId }, orderBy: { createdAt: 'desc' }, take: 5 }),
      db.followUp.findMany({ where: { leadId, tenantId: ctx.tenantId }, orderBy: { dueAt: 'desc' }, take: 5 }),
      db.note.findMany({ where: { leadId, tenantId: ctx.tenantId }, orderBy: { createdAt: 'desc' }, take: 5 }),
    ]);

    const [businessProfile, businessDNA] = await Promise.all([
      db.businessProfile.findUnique({ where: { tenantId: ctx.tenantId! } }),
      getBusinessDNA(ctx.tenantId!),
    ]);

    // Build script using business DNA + lead context (rule-based, AI-augmented)
    const greeting = `Hello ${lead.name}, this is ${(ctx.session as any).name || 'a representative'} from ${businessProfile?.businessName || 'our company'}.`;
    const context = `I see you${lead.company ? ` from ${lead.company}` : ''} ${lead.email ? `(email: ${lead.email})` : ''}.`;
    const lastInteraction = previousCalls[0]
      ? `We last spoke on ${new Date(previousCalls[0].createdAt).toLocaleDateString()} — outcome: ${previousCalls[0].outcome || 'no specific outcome'}.`
      : 'This is our first conversation with you.';
    const purpose = `I'm calling to understand your needs regarding ${businessProfile?.productsCsv || businessProfile?.servicesCsv || 'our offerings'}.`;

    const script = `${greeting}\n\n${context}\n${lastInteraction}\n\n${purpose}\n\nMay I have 2 minutes of your time?`;

    // Objection handling suggestions (rule-based)
    const objections = [
      { trigger: 'Not interested', response: 'I understand. May I ask what specifically doesn\'t interest you? Perhaps we can address your concern or schedule a call when it\'s more convenient.' },
      { trigger: 'Too busy', response: 'No problem. When would be a good time to call back? I can send a brief summary via WhatsApp/email if you prefer.' },
      { trigger: 'Already have a vendor', response: 'That\'s great to hear. We\'re not asking you to switch — just sharing what we offer in case you need a backup option or have any unmet needs.' },
      { trigger: 'Too expensive', response: 'I understand pricing is important. We have multiple plans — would you like to hear about our most affordable option first?' },
      { trigger: 'Send me an email', response: `Sure, I'll send details to ${lead.email || 'your email'}. What specific information would be most useful — pricing, product details, or case studies?` },
    ];

    // Indian-language support (architecture — actual multi-language requires AI provider)
    const supportedLanguages = ['en-IN', 'hi-IN', 'bn-IN', 'ta-IN', 'te-IN', 'mr-IN', 'gu-IN', 'kn-IN', 'ml-IN', 'pa-IN'];
    const languageNote = 'Indian-language voice support is architecture-ready. Actual multi-language calling requires a configured AI voice provider (e.g., Sarvam AI, ElevenLabs multilingual).';

    // Try AI-augmented script (optional)
    let aiScript: string | null = null;
    try {
      const aiRes = await callAI({
        prompt: `${assertFacts('Generate a brief, courteous 4-line sales call script for this lead.')}\n\nBusiness: ${buildBusinessContext(businessDNA, businessProfile)}\n\nLead: ${lead.name}, ${lead.company || 'individual'}, stage=${lead.stage}, value=${lead.value}.\n\nPrevious interactions: ${previousCalls.length} calls, ${followUps.length} follow-ups.\n\nScript:`,
        systemPrompt: 'You are an AI telecaller scriptwriter. Be concise, professional, never invent business facts.',
        temperature: 0.4,
        maxTokens: 200,
      }, { tenantId: ctx.tenantId, feature: 'ai_telecaller' });
      if (aiRes.ok && typeof aiRes.data === 'string' && aiRes.data.length > 30 && !aiRes.data.includes('AI provider unavailable')) {
        aiScript = aiRes.data;
      }
    } catch {}

    return {
      ok: true,
      lead: {
        id: lead.id,
        name: lead.name,
        company: lead.company,
        email: lead.email,
        phone: lead.phone,
        stage: lead.stage,
        status: lead.status,
        value: lead.value,
        lastActivityAt: lead.lastActivityAt,
      },
      callPreparation: {
        greeting,
        context,
        lastInteraction,
        purpose,
        script,
        aiScript,
      },
      objections,
      previousCalls: previousCalls.map((c) => ({
        id: c.id,
        outcome: c.outcome,
        duration: c.duration,
        createdAt: c.createdAt,
      })),
      followUps: followUps.map((f) => ({
        id: f.id,
        title: f.title,
        dueAt: f.dueAt,
        completedAt: f.completedAt,
        outcome: f.outcome,
      })),
      notes: notes.map((n) => ({
        id: n.id,
        content: n.content,
        createdAt: n.createdAt,
      })),
      languages: {
        supported: supportedLanguages,
        note: languageNote,
      },
    };
  });
}

// POST: save call summary + outcome + auto-create follow-up
const SUMMARY_SCHEMA = z.object({
  leadId: z.string(),
  callId: z.string().optional(), // link to existing Call record
  outcome: z.string().min(2).max(200),
  summary: z.string().max(2000).optional(),
  nextFollowUpAt: z.string().optional(), // ISO date
  duration: z.number().int().min(0).optional(),
});

export async function POST(req: NextRequest) {
  return withTenant(req, async (ctx: AuthContext) => {
    const body = await req.json().catch(() => ({}));
    const parsed = SUMMARY_SCHEMA.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'invalid_input', details: parsed.error.flatten() }, { status: 400 });
    }
    const d = parsed.data;

    // Verify lead belongs to tenant
    const lead = await db.lead.findFirst({ where: { id: d.leadId, tenantId: ctx.tenantId } });
    if (!lead) return NextResponse.json({ error: 'lead_not_found' }, { status: 404 });

    // Create or update Call record
    let call;
    if (d.callId) {
      call = await db.call.update({
        where: { id: d.callId },
        data: {
          outcome: d.outcome,
          duration: d.duration || 0,
          notes: d.summary || '',
          status: 'connected',
        },
      });
    } else {
      call = await db.call.create({
        data: {
          tenantId: ctx.tenantId!,
          leadId: d.leadId,
          callerId: ctx.session.sub,
          direction: 'outbound',
          status: 'connected',
          outcome: d.outcome,
          duration: d.duration || 0,
          notes: d.summary || '',
          telecaller: 'human',
        },
      });
    }

    // Update lead's lastActivityAt
    await db.lead.update({
      where: { id: d.leadId },
      data: { lastActivityAt: new Date() },
    });

    // Create follow-up if requested
    let followUp = null;
    if (d.nextFollowUpAt) {
      try {
        followUp = await db.followUp.create({
          data: {
            tenantId: ctx.tenantId!,
            leadId: d.leadId,
            title: `Follow-up: ${d.outcome}`,
            dueAt: new Date(d.nextFollowUpAt),
            ownerId: ctx.session.sub,
          },
        });
      } catch (e) { /* ignore follow-up creation failure */ }
    }

    return {
      ok: true,
      callId: call.id,
      followUpId: followUp?.id || null,
      summary: d.summary || d.outcome,
    };
  });
}
