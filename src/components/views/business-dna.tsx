'use client';

import { useEffect, useState } from 'react';
import { apiGet, apiPost } from '@/lib/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Loader2, Dna, RefreshCw, Pencil, Check, X, Building2, Workflow, Target, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

interface DNA {
  industry: string;
  businessModel: string;
  productsServices: string[];
  customerSegments: string[];
  salesStages: string[];
  operationalStages: string[];
  departments: string[];
  roles: string[];
  kpis: string[];
  workflowDefs: any[];
  automationOpps: string[];
  aiPriorities: string[];
  customFields: any[];
  terminology: any[];
}

export function BusinessDNAView() {
  const [dna, setDna] = useState<DNA | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editedJson, setEditedJson] = useState('');

  async function load() {
    setLoading(true);
    try {
      const data = await apiGet<{ dna: DNA; profile: any }>('/api/ai/business-dna');
      setDna(data.dna);
      setProfile(data.profile);
      setEditedJson(JSON.stringify(data.dna, null, 2));
    } catch (e: any) {
      toast.error('Failed: ' + e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function regenerate() {
    setRegenerating(true);
    try {
      await apiPost('/api/ai/business-dna?op=regenerate');
      toast.success('DNA regenerated');
      await load();
    } catch (e: any) {
      toast.error('Regenerate failed: ' + e.message);
    } finally {
      setRegenerating(false);
    }
  }

  async function saveEdit() {
    try {
      const parsed = JSON.parse(editedJson);
      await apiPost('/api/ai/business-dna?op=update', parsed);
      toast.success('DNA updated');
      setEditing(false);
      await load();
    } catch (e: any) {
      toast.error('Invalid JSON or save failed: ' + e.message);
    }
  }

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Dna className="h-6 w-6 text-primary" />
            Business DNA
          </h1>
          <p className="text-sm text-muted-foreground">
            The brain of your AI Operator. Adapts OPERA AI to your business — no developer needed.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setEditing((v) => !v)}>
            {editing ? <><X className="h-4 w-4 mr-1.5" /> Cancel edit</> : <><Pencil className="h-4 w-4 mr-1.5" /> Edit JSON</>}
          </Button>
          <Button variant="outline" size="sm" onClick={regenerate} disabled={regenerating}>
            {regenerating ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1.5" />}
            Regenerate
          </Button>
        </div>
      </div>

      {/* Business profile summary */}
      {profile && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <Building2 className="h-5 w-5 text-primary mt-1" />
              <div className="flex-1 grid sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
                <Field label="Business name" value={profile.businessName} />
                <Field label="Industry" value={profile.industry} />
                <Field label="Type" value={profile.businessType} />
                <Field label="Currency" value={profile.currency} />
                <Field label="Uses inventory" value={profile.usesInventory ? 'Yes' : 'No'} />
                <Field label="Departments" value={profile.departments || '—'} />
                <Field label="Lead sources" value={profile.leadSources || '—'} />
                <Field label="Sales process" value={profile.salesProcess || '—'} />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {editing && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Edit DNA as JSON</CardTitle>
            <CardDescription className="text-xs">Modify any field. The structure must remain valid JSON.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              value={editedJson}
              onChange={(e) => setEditedJson(e.target.value)}
              rows={20}
              className="font-mono text-xs"
            />
            <Button onClick={saveEdit} size="sm"><Check className="h-4 w-4 mr-1.5" /> Save</Button>
          </CardContent>
        </Card>
      )}

      {!editing && dna && (
        <div className="space-y-4">
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <DNASection title="Industry" icon={Building2} items={[dna.industry]} />
            <DNASection title="Business model" icon={Building2} items={[dna.businessModel]} />
            <DNASection title="Customer segments" icon={Target} items={dna.customerSegments} />
            <DNASection title="Sales stages" icon={Workflow} items={dna.salesStages} numbered />
            <DNASection title="Operational stages" icon={Workflow} items={dna.operationalStages} numbered />
            <DNASection title="Departments" icon={Building2} items={dna.departments} />
            <DNASection title="Roles" icon={Target} items={dna.roles} />
            <DNASection title="KPIs" icon={Target} items={dna.kpis} />
            <DNASection title="Products & services" icon={Building2} items={dna.productsServices} />
            <DNASection title="Automation opportunities" icon={Sparkles} items={dna.automationOpps} />
            <DNASection title="AI priorities" icon={Sparkles} items={dna.aiPriorities} />
            <DNASection title="Custom fields" icon={Pencil} items={dna.customFields.map((f: any) => `${f.entity}.${f.key} (${f.type}) — ${f.label}`)} />
          </div>

          {/* Workflow defs */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><Workflow className="h-4 w-4 text-primary" /> Workflow Definitions</CardTitle>
              <CardDescription className="text-xs">AI-generated starter workflows — fully editable.</CardDescription>
            </CardHeader>
            <CardContent>
              {dna.workflowDefs.length === 0 ? (
                <p className="text-sm text-muted-foreground">No workflows defined.</p>
              ) : (
                <div className="space-y-2">
                  {dna.workflowDefs.map((w: any, i: number) => (
                    <div key={i} className="border rounded-md p-3 text-sm">
                      <div className="font-medium">{w.name}</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        <span className="font-medium">Trigger:</span> {w.trigger}
                        {w.conditions && <><span className="mx-1.5">·</span><span className="font-medium">Conditions:</span> {w.conditions}</>}
                      </div>
                      {w.actions && <div className="text-xs text-muted-foreground mt-1"><span className="font-medium">Actions:</span> {w.actions}</div>}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase text-muted-foreground tracking-wider">{label}</div>
      <div className="text-sm font-medium truncate" title={value}>{value || '—'}</div>
    </div>
  );
}

function DNASection({ title, icon: Icon, items, numbered }: { title: string; icon: any; items: string[]; numbered?: boolean }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <Icon className="h-4 w-4 text-primary" />
          <span className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">{title}</span>
        </div>
        {items.length === 0 ? (
          <p className="text-xs text-muted-foreground">Not specified</p>
        ) : numbered ? (
          <ol className="text-sm space-y-0.5 list-decimal ml-4">
            {items.map((i, idx) => <li key={idx}>{i}</li>)}
          </ol>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {items.map((i, idx) => <Badge key={idx} variant="secondary" className="text-[10px]">{i}</Badge>)}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
