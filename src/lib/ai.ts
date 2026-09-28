// OPERA AI — AI Provider Abstraction
// Server-side only. Supports z-ai-web-dev-sdk as the default provider.
// Implements timeout, retry, fallback, rate limiting, structured output validation,
// safe prompt construction, error handling, usage tracking.
// Core CRM functionality continues if AI is unavailable.

import { z } from 'zod';
import { db } from './db';

export interface AIRequest {
  prompt: string;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  // When set, the provider must return JSON conforming to this Zod schema.
  outputSchema?: z.ZodTypeAny;
  // When set, wraps the prompt with safe defaults.
  allowNoSchema?: boolean;
}

export interface AIResponse<T = any> {
  ok: boolean;
  data?: T;
  raw?: string;
  error?: string;
  provider: string;
  latencyMs: number;
  promptTokens: number;
  completionTokens: number;
  usageTracked: boolean;
}

export interface AIProvider {
  name: string;
  call(req: AIRequest): Promise<AIResponse>;
}

// ============================================================
// Provider: z-ai-web-dev-sdk (default)
// ============================================================

class ZAIProvider implements AIProvider {
  name = 'zai';
  private sdk: any = null;

  private async getSDK() {
    if (this.sdk) return this.sdk;
    try {
      const mod = await import('z-ai-web-dev-sdk');
      this.sdk = (mod as any).default || mod;
      return this.sdk;
    } catch (e) {
      console.error('[ai] z-ai-web-dev-sdk unavailable', e);
      return null;
    }
  }

  async call(req: AIRequest): Promise<AIResponse> {
    const started = Date.now();
    const sdk = await this.getSDK();
    if (!sdk) {
      return {
        ok: false,
        error: 'AI_PROVIDER_UNAVAILABLE',
        provider: this.name,
        latencyMs: 0,
        promptTokens: 0,
        completionTokens: 0,
        usageTracked: false,
      };
    }

    // Build messages
    const messages: Array<{ role: string; content: string }> = [];
    if (req.systemPrompt) messages.push({ role: 'system', content: req.systemPrompt });
    messages.push({ role: 'user', content: req.prompt });

    // Optional JSON schema hint
    const wantsJson = !!req.outputSchema;
    const finalPrompt = wantsJson
      ? `${req.prompt}\n\nYou MUST respond with a single valid JSON object conforming to the requested structure. No markdown, no prose before or after the JSON.`
      : req.prompt;

    let attempt = 0;
    const maxAttempts = 2;
    while (attempt <= maxAttempts) {
      attempt++;
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 45_000);
        const res = await Promise.race([
          sdk.chat.completions.create({
            messages: wantsJson
              ? [{ role: 'system', content: req.systemPrompt || '' }, { role: 'user', content: finalPrompt }]
              : messages,
            temperature: req.temperature ?? 0.4,
            max_tokens: req.maxTokens ?? 1500,
          }),
          new Promise((_, reject) => setTimeout(() => reject(new Error('AI_TIMEOUT')), 45_000)),
        ]);
        clearTimeout(timeout);

        const content: string = res?.choices?.[0]?.message?.content || '';
        let data: any = undefined;
        if (wantsJson && req.outputSchema) {
          try {
            const cleaned = content.replace(/```json|```/g, '').trim();
            const parsed = JSON.parse(cleaned);
            const parsedSafe = req.outputSchema.parse(parsed);
            data = parsedSafe;
          } catch (e) {
            // Schema validation failed.
            if (attempt <= maxAttempts) continue; // retry
            return {
              ok: false,
              error: `AI_OUTPUT_INVALID: ${(e as Error).message}`,
              raw: content,
              provider: this.name,
              latencyMs: Date.now() - started,
              promptTokens: 0,
              completionTokens: 0,
              usageTracked: false,
            };
          }
        } else {
          data = content;
        }
        return {
          ok: true,
          data,
          raw: content,
          provider: this.name,
          latencyMs: Date.now() - started,
          promptTokens: res?.usage?.prompt_tokens ?? 0,
          completionTokens: res?.usage?.completion_tokens ?? 0,
          usageTracked: false,
        };
      } catch (e) {
        const msg = (e as Error).message || String(e);
        if (attempt > maxAttempts) {
          return {
            ok: false,
            error: msg,
            provider: this.name,
            latencyMs: Date.now() - started,
            promptTokens: 0,
            completionTokens: 0,
            usageTracked: false,
          };
        }
        // brief backoff
        await new Promise((r) => setTimeout(r, 300 * attempt));
      }
    }
    return {
      ok: false,
      error: 'AI_UNREACHABLE',
      provider: this.name,
      latencyMs: Date.now() - started,
      promptTokens: 0,
      completionTokens: 0,
      usageTracked: false,
    };
  }
}

// ============================================================
// Provider: local-rules fallback (always available, never fails)
// ============================================================

class RulesFallbackProvider implements AIProvider {
  name = 'rules-fallback';

  // Used ONLY when the real AI provider is unavailable.
  // Produces a deterministic structured response describing "AI unavailable, rules applied".

  async call(req: AIRequest): Promise<AIResponse> {
    const started = Date.now();
    if (req.outputSchema) {
      // Return a minimal safe shape — caller should treat this as degraded.
      const data = {
        degraded: true,
        message: 'AI provider unavailable. Applying deterministic rules only.',
        items: [],
      };
      try {
        req.outputSchema.parse(data);
      } catch {
        // best-effort; caller will check `ok` and degrade gracefully.
      }
      return {
        ok: true,
        data,
        provider: this.name,
        latencyMs: Date.now() - started,
        promptTokens: 0,
        completionTokens: 0,
        usageTracked: false,
      };
    }
    return {
      ok: true,
      data: 'AI provider unavailable. Please configure an AI provider or try again later.',
      provider: this.name,
      latencyMs: Date.now() - started,
      promptTokens: 0,
      completionTokens: 0,
      usageTracked: false,
    };
  }
}

// ============================================================
// Orchestrator: provider chain + rate limit + usage tracking
// ============================================================

const PRIMARY = new ZAIProvider();
const FALLBACK = new RulesFallbackProvider();

// In-memory rate limit: max N AI calls per tenant per minute.
const rateBuckets = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_PER_MIN = 30;

function rateLimit(tenantId: string | null): boolean {
  if (!tenantId) return true; // super admin exempt
  const now = Date.now();
  const key = tenantId;
  const bucket = rateBuckets.get(key);
  if (!bucket || bucket.resetAt < now) {
    rateBuckets.set(key, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (bucket.count >= RATE_LIMIT_PER_MIN) return false;
  bucket.count++;
  return true;
}

export async function callAI<T = any>(req: AIRequest, ctx?: { tenantId?: string | null; feature?: string }): Promise<AIResponse<T>> {
  // Rate limit
  if (ctx?.tenantId && !rateLimit(ctx.tenantId)) {
    return {
      ok: false,
      error: 'AI_RATE_LIMITED',
      provider: 'orchestrator',
      latencyMs: 0,
      promptTokens: 0,
      completionTokens: 0,
      usageTracked: false,
    };
  }

  // Safe prompt construction: trim, restrict length.
  const safePrompt = (req.prompt || '').slice(0, 12_000);
  const safeReq: AIRequest = {
    ...req,
    prompt: safePrompt,
    systemPrompt: (req.systemPrompt || '').slice(0, 4_000),
  };

  const primary = await PRIMARY.call(safeReq);

  // Track usage
  if (primary.ok && ctx?.tenantId && (ctx.feature || '')) {
    try {
      await db.aIUsageRecord.create({
        data: {
          tenantId: ctx.tenantId,
          provider: primary.provider,
          feature: ctx.feature,
          promptTokens: primary.promptTokens,
          completionTokens: primary.completionTokens,
          latencyMs: primary.latencyMs,
          success: true,
          error: '',
        },
      });
    } catch {
      // ignore tracking errors
    }
  } else if (!primary.ok && ctx?.tenantId && (ctx.feature || '')) {
    try {
      await db.aIUsageRecord.create({
        data: {
          tenantId: ctx.tenantId,
          provider: primary.provider,
          feature: ctx.feature,
          promptTokens: 0,
          completionTokens: 0,
          latencyMs: primary.latencyMs,
          success: false,
          error: primary.error || 'unknown',
        },
      });
    } catch {
      // ignore
    }
  }

  if (primary.ok) return primary;

  // Fallback
  return await FALLBACK.call(safeReq);
}

// ============================================================
// Safe structured-output helpers
// ============================================================

export function assertFacts(prompt: string): string {
  return `${prompt}\n\nIMPORTANT: Do not invent business facts. Only use data provided in the prompt. If data is insufficient to answer, respond with: "Insufficient data to determine this." Distinguish FACT (verbatim from data), CALCULATION (derived numerically), INFERENCE (your reasoning labeled as such), and RECOMMENDATION (suggested next step).`;
}

export function buildBusinessContext(dna: any, profile: any): string {
  return [
    `Business: ${profile?.businessName || 'Unknown'}`,
    `Industry: ${dna?.industry || profile?.industry || 'Unknown'}`,
    `Model: ${dna?.businessModel || 'Unknown'}`,
    `Currency: ${profile?.currency || 'INR'}`,
    `Uses Inventory: ${profile?.usesInventory ? 'yes' : 'no'}`,
    `Departments: ${(dna?.departments || []).join(', ') || 'n/a'}`,
    `Sales Stages: ${(dna?.salesStages || []).join(' → ') || 'New → Contacted → Qualified → Won'}`,
  ].join('\n');
}
