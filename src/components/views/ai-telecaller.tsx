'use client';

import { useEffect, useState } from 'react';
import { apiGet, apiPost, formatDateTime } from '@/lib/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Phone, ScrollText, Save, Sparkles, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';

interface ScriptData {
  ok: boolean;
  lead: any;
  callPreparation: {
    greeting: string;
    context: string;
    lastInteraction: string;
    purpose: string;
    script: string;
    aiScript: string | null;
  };
  objections: Array<{ trigger: string; response: string }>;
  previousCalls: any[];
  followUps: any[];
  notes: any[];
  languages: { supported: string[]; note: string };
}

export function AITelecallerView() {
  const [leadId, setLeadId] = useState('');
  const [data, setData] = useState<ScriptData | null>(null);
  const [loading, setLoading] = useState(false);
  const [outcome, setOutcome] = useState('');
  const [summary, setSummary] = useState('');
  const [nextFollowUp, setNextFollowUp] = useState('');
  const [saving, setSaving] = useState(false);

  async function fetchScript() {
    if (!leadId.trim()) {
      toast.error('Enter a lead ID first');
      return;
    }
    setLoading(true);
    setData(null);
    try {
      const res = await apiGet<ScriptData>(`/api/ai-telecaller?leadId=${leadId.trim()}`);
      setData(res);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function saveSummary() {
    if (!outcome.trim()) {
      toast.error('Outcome is required');
      return;
    }
    setSaving(true);
    try {
      const res = await apiPost('/api/ai-telecaller', {
        leadId,
        outcome,
        summary,
        nextFollowUpAt: nextFollowUp || undefined,
      });
      toast.success(`Call summary saved. Call ID: ${res.callId}`);
      if (res.followUpId) toast.success(`Follow-up created: ${res.followUpId}`);
      setOutcome(''); setSummary(''); setNextFollowUp('');
      // Refresh script
      await fetchScript();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <Phone className="h-6 w-6 text-primary" /> AI Telecaller
        </h1>
        <p className="text-sm text-muted-foreground">
          Call preparation, scripts, objection handling, call summaries, follow-up recommendations.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Enter a lead ID to fetch call preparation</CardTitle>
          <CardDescription className="text-xs">
            Get the lead's full context, previous calls, follow-ups, AI-suggested script, and objection handling.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input value={leadId} onChange={(e) => setLeadId(e.target.value)} placeholder="cmul... (Lead ID)" />
            <Button onClick={fetchScript} disabled={loading || !leadId.trim()}>
              {loading ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <ScrollText className="h-4 w-4 mr-1.5" />}
              Fetch script
            </Button>
          </div>
          {data && (
            <p className="text-[10px] text-muted-foreground mt-2">
              Or pick from recent leads via the Leads view → copy an ID.
            </p>
          )}
        </CardContent>
      </Card>

      {loading && <Skeleton className="h-64" />}

      {data && data.ok && (
        <>
          {/* Lead context */}
          <Card className="border-l-4 border-l-primary">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Phone className="h-4 w-4 text-primary" /> Lead context
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
                <div><div className="text-[10px] uppercase text-muted-foreground">Name</div><div className="font-medium">{data.lead.name}</div></div>
                <div><div className="text-[10px] uppercase text-muted-foreground">Company</div><div>{data.lead.company || '—'}</div></div>
                <div><div className="text-[10px] uppercase text-muted-foreground">Phone</div><div className="font-mono text-xs">{data.lead.phone || '—'}</div></div>
                <div><div className="text-[10px] uppercase text-muted-foreground">Stage</div><div><Badge variant="secondary" className="text-[10px]">{data.lead.stage}</Badge></div></div>
              </div>
            </CardContent>
          </Card>

          {/* Call script */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <ScrollText className="h-4 w-4 text-primary" /> Suggested script
                {data.callPreparation.aiScript && <Badge variant="secondary" className="text-[10px] bg-violet-100 text-violet-900"><Sparkles className="h-3 w-3 mr-1" /> AI-enhanced</Badge>}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="bg-muted/30 rounded-md p-3 text-sm whitespace-pre-line">
                {data.callPreparation.aiScript || data.callPreparation.script}
              </div>
              {!data.callPreparation.aiScript && (
                <p className="text-[10px] text-muted-foreground">Rule-based script. AI-augmented script available when AI provider is configured.</p>
              )}
            </CardContent>
          </Card>

          {/* Objection handling */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><MessageSquare className="h-4 w-4 text-primary" /> Objection handling</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {data.objections.map((o, i) => (
                  <div key={i} className="border rounded-md p-2.5 text-sm">
                    <div className="font-medium text-xs text-amber-700">If customer says: "{o.trigger}"</div>
                    <div className="text-xs text-muted-foreground mt-1">{o.response}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Previous interactions */}
          {(data.previousCalls.length > 0 || data.followUps.length > 0) && (
            <div className="grid sm:grid-cols-2 gap-3">
              <Card>
                <CardHeader><CardTitle className="text-sm">Previous calls ({data.previousCalls.length})</CardTitle></CardHeader>
                <CardContent>
                  {data.previousCalls.map((c) => (
                    <div key={c.id} className="text-xs border-b last:border-0 py-1.5">
                      <div className="font-medium">{c.outcome || 'No outcome'}</div>
                      <div className="text-muted-foreground">{formatDateTime(c.createdAt)} · {c.duration}s</div>
                    </div>
                  ))}
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="text-sm">Follow-ups ({data.followUps.length})</CardTitle></CardHeader>
                <CardContent>
                  {data.followUps.map((f) => (
                    <div key={f.id} className="text-xs border-b last:border-0 py-1.5">
                      <div className="font-medium">{f.title}</div>
                      <div className="text-muted-foreground">{formatDateTime(f.dueAt)} · {f.completedAt ? '✓ done' : 'pending'}</div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          )}

          {/* Save call summary */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><Save className="h-4 w-4 text-primary" /> Save call summary + create follow-up</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label className="text-xs">Outcome *</Label>
                <Input value={outcome} onChange={(e) => setOutcome(e.target.value)} placeholder="e.g., Customer interested — sent quotation" />
              </div>
              <div>
                <Label className="text-xs">Call summary</Label>
                <Textarea value={summary} onChange={(e) => setSummary(e.target.value)} rows={3} placeholder="Detailed notes about the call..." />
              </div>
              <div>
                <Label className="text-xs">Schedule follow-up (optional)</Label>
                <Input type="datetime-local" value={nextFollowUp} onChange={(e) => setNextFollowUp(e.target.value)} />
              </div>
              <Button onClick={saveSummary} disabled={saving || !outcome.trim()}>
                {saving ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Save className="h-4 w-4 mr-1.5" />}
                Save summary
              </Button>
            </CardContent>
          </Card>

          {/* Indian-language support */}
          <Card className="bg-amber-50 border-amber-200">
            <CardContent className="p-3 text-xs text-amber-900">
              <p className="font-medium mb-1">🌐 Indian-language support (architecture)</p>
              <p>Supported languages: {data.languages.supported.join(', ')}</p>
              <p className="mt-1">{data.languages.note}</p>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
