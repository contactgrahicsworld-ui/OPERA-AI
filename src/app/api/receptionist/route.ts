// AI Receptionist — handles customer enquiries via intent detection + business info retrieval
// Per spec: understand enquiry → identify intent → retrieve authorized business info →
// answer FAQs → create lead → create appointment → create task → escalate to human
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { withTenant, type AuthContext } from '@/lib/api-helpers';
import { callAI, buildBusinessContext, assertFacts } from '@/lib/ai';
import { getBusinessDNA } from '@/lib/business-dna';
import { z } from 'zod';

const ENQUIRY_SCHEMA = z.object({
  message: z.string().min(2).max(1000),
  customerName: z.string().optional(),
  customerPhone: z.string().optional(),
  customerEmail: z.string().email().optional(),
  // Channel: web | whatsapp | phone
  channel: z.enum(['web', 'whatsapp', 'phone']).default('web'),
});

const INTENTS = [
  'product_information',
  'pricing',
  'business_hours',
  'support_request',
  'complaint',
  'sales_enquiry',
  'appointment_request',
  'general_info',
  'escalation',
];

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  return withTenant(req, async (ctx: AuthContext) => {
    const body = await req.json().catch(() => ({}));
    const parsed = ENQUIRY_SCHEMA.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'invalid_input', details: parsed.error.flatten() }, { status: 400 });
    }
    const d = parsed.data;

    // 1. Retrieve authorized business info
    const [businessProfile, businessDNA] = await Promise.all([
      db.businessProfile.findUnique({ where: { tenantId: ctx.tenantId! } }),
      getBusinessDNA(ctx.tenantId!),
    ]);

    if (!businessProfile) {
      return {
        ok: false,
        error: 'no_business_profile',
        message: 'Business profile not configured. Receptionist cannot answer.',
      };
    }

    // 2. Detect intent (rule-based for reliability — AI augments)
    const msg = d.message.toLowerCase();
    let intent: string = 'general_info';
    if (/price|cost|rate|fee|charge|pricing/.test(msg)) intent = 'pricing';
    else if (/hour|open|close|time|when/.test(msg)) intent = 'business_hours';
    else if (/problem|issue|complaint|broken|not working|error/.test(msg)) intent = 'complaint';
    else if (/book|appointment|schedule|meet|demo/.test(msg)) intent = 'appointment_request';
    else if (/support|help|assist/.test(msg)) intent = 'support_request';
    else if (/buy|purchase|order|quote|quotation/.test(msg)) intent = 'sales_enquiry';
    else if (/product|service|what.*do you|offer/.test(msg)) intent = 'product_information';
    else if (/human|agent|manager|talk to/.test(msg)) intent = 'escalation';

    // 3. Build response based on intent + business data
    let response = '';
    let actionType: 'none' | 'create_lead' | 'create_appointment' | 'create_task' | 'escalate' = 'none';
    let actionData: any = {};

    switch (intent) {
      case 'pricing':
        response = `Our pricing: ${businessProfile.productsCsv || 'various products/services'}. For detailed pricing, please share your requirement and our team will send a custom quote. (Business: ${businessProfile.businessName})`;
        actionType = 'create_lead';
        break;
      case 'business_hours':
        response = `Business hours: ${businessProfile.businessHours || 'standard business hours'}. Location: ${businessProfile.locations || 'see website'}.`;
        break;
      case 'product_information':
        response = `We offer: Products — ${businessProfile.productsCsv || 'n/a'}; Services — ${businessProfile.servicesCsv || 'n/a'}. Industry: ${businessProfile.industry}. Would you like to talk to our sales team?`;
        actionType = 'create_lead';
        break;
      case 'appointment_request':
        response = `I can help schedule an appointment. Please share your preferred date/time. Our team will confirm via ${d.channel}.`;
        actionType = 'create_appointment';
        break;
      case 'sales_enquiry':
        response = `Thanks for your interest! I'll create a lead for our sales team. They'll reach out to you with a quotation.`;
        actionType = 'create_lead';
        break;
      case 'support_request':
      case 'complaint':
        response = `I'm creating a support task for your issue. Our team will prioritize and respond. Reference: your phone/email.`;
        actionType = 'create_task';
        break;
      case 'escalation':
        response = `I'll escalate this to a human agent. They will contact you shortly. Alternatively, you can reach our team directly.`;
        actionType = 'escalate';
        break;
      default:
        response = `Thanks for your enquiry about "${businessProfile.businessName}". I can help with: pricing, products, business hours, appointments, sales, support. What would you like to know?`;
    }

    // 4. Execute action (create lead/appointment/task)
    let actionResult: any = null;
    if (actionType === 'create_lead' && (d.customerPhone || d.customerEmail)) {
      try {
        const lead = await db.lead.create({
          data: {
            tenantId: ctx.tenantId!,
            name: d.customerName || 'Receptionist Lead',
            email: d.customerEmail || '',
            phone: d.customerPhone || '',
            source: `receptionist_${d.channel}`,
            status: 'New',
            stage: 'New',
            notes: `Enquiry: ${d.message}`,
          },
        });
        actionResult = { type: 'lead_created', leadId: lead.id };
      } catch (e) { actionResult = { type: 'lead_create_failed', error: (e as Error).message }; }
    } else if (actionType === 'create_appointment') {
      try {
        const task = await db.task.create({
          data: {
            tenantId: ctx.tenantId!,
            title: `Appointment request: ${d.customerName || 'Unknown'}`,
            type: 'general',
            status: 'open',
            priority: 'medium',
            dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
            notes: `Customer enquiry: ${d.message}. Channel: ${d.channel}.`,
          },
        });
        actionResult = { type: 'appointment_task_created', taskId: task.id };
      } catch (e) { actionResult = { type: 'appointment_create_failed', error: (e as Error).message }; }
    } else if (actionType === 'create_task') {
      try {
        const task = await db.task.create({
          data: {
            tenantId: ctx.tenantId!,
            title: `Support: ${d.customerName || 'Enquiry'}`,
            type: 'general',
            status: 'open',
            priority: 'high',
            dueDate: new Date(Date.now() + 4 * 60 * 60 * 1000),
            notes: `Customer enquiry: ${d.message}. Channel: ${d.channel}. Contact: ${d.customerPhone || d.customerEmail || 'n/a'}.`,
          },
        });
        actionResult = { type: 'support_task_created', taskId: task.id };
      } catch (e) { actionResult = { type: 'task_create_failed', error: (e as Error).message }; }
    } else if (actionType === 'escalate') {
      try {
        const notification = await db.notification.create({
          data: {
            tenantId: ctx.tenantId!,
            type: 'critical',
            title: `Escalation: ${d.customerName || 'Customer'}`,
            body: `Enquiry: ${d.message}. Channel: ${d.channel}. Contact: ${d.customerPhone || d.customerEmail || 'n/a'}.`,
            isRead: false,
          },
        });
        actionResult = { type: 'escalation_notification_created', notificationId: notification.id };
      } catch (e) { actionResult = { type: 'escalation_failed', error: (e as Error).message }; }
    }

    // 5. Try AI-augmented response (optional — falls back to rule-based if unavailable)
    let aiEnhanced = false;
    try {
      const aiRes = await callAI({
        prompt: `${assertFacts('Customer enquiry for this business. Reply courteously in 1-2 sentences using ONLY the provided business info.')}\n\nBusiness: ${buildBusinessContext(businessDNA, businessProfile)}\n\nCustomer message: ${d.message}\n\nDetected intent: ${intent}\n\nReply:`,
        systemPrompt: 'You are an AI receptionist for the business above. Be concise, courteous. Never invent business facts. If you don\'t know, say "Let me connect you with our team."',
        temperature: 0.4,
        maxTokens: 200,
      }, { tenantId: ctx.tenantId, feature: 'receptionist' });
      if (aiRes.ok && typeof aiRes.data === 'string' && aiRes.data.length > 10 && !aiRes.data.includes('AI provider unavailable')) {
        response = aiRes.data;
        aiEnhanced = true;
      }
    } catch {}

    // Audit
    await db.auditTrailEntry.create({
      data: {
        tenantId: ctx.tenantId!,
        userId: ctx.session.sub,
        action: 'receptionist_enquiry',
        entity: 'activity',
        entityId: actionResult?.leadId || actionResult?.taskId || actionResult?.notificationId || '',
        details: { intent, channel: d.channel, actionType, aiEnhanced },
        ip: req.headers.get('x-forwarded-for') || '',
        userAgent: req.headers.get('user-agent') || '',
      },
    }).catch(() => {});

    return {
      ok: true,
      intent,
      response,
      action: actionType,
      actionResult,
      aiEnhanced,
      businessContext: {
        name: businessProfile.businessName,
        hours: businessProfile.businessHours,
        products: businessProfile.productsCsv,
        services: businessProfile.servicesCsv,
      },
    };
  });
}

// GET: return the list of supported intents (for UI display)
export async function GET() {
  return NextResponse.json({ intents: INTENTS });
}
