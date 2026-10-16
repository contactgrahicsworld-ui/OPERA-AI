'use client';

import { useEffect, useState } from 'react';
import { apiGet, apiPost, formatDateTime } from '@/lib/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Shield, Building2, CreditCard, ScrollText, Cpu, Power, Loader2, Check, Settings2, Smartphone, Wallet, Mail } from 'lucide-react';
import { toast } from 'sonner';

interface Overview { tenants: number; users: number; plans: number; aiCalls: number; }
interface TenantRow { id: string; name: string; slug: string; status: string; plan?: { name: string }; _count: { users: number }; createdAt: string; trialEndsAt?: string; }
interface PlanRow { id: string; name: string; description: string; priceMonthly: number; priceYearly: number; trialDays: number; maxUsers: number; maxStorageMb: number; maxAiCalls: number; featuresCsv: string; isDefault: boolean; }
interface AuditRow { id: string; action: string; entity: string; entityId: string; details: string; ip: string; createdAt: string; tenant?: { name: string; slug: string }; }

export function SuperAdminView() {
  const [tab, setTab] = useState('overview');
  const [overview, setOverview] = useState<Overview | null>(null);
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [aiUsage, setAiUsage] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const [ov, t, p, au, ai] = await Promise.all([
        apiGet<Overview>('/api/super-admin?op=overview').catch(() => ({ tenants: 0, users: 0, plans: 0, aiCalls: 0 })),
        apiGet<{ items: TenantRow[] }>('/api/super-admin?op=tenants').catch(() => ({ items: [] })),
        apiGet<{ items: PlanRow[] }>('/api/super-admin?op=plans').catch(() => ({ items: [] })),
        apiGet<{ items: AuditRow[] }>('/api/super-admin?op=audit&limit=100').catch(() => ({ items: [] })),
        apiGet<{ records: any[] }>('/api/super-admin?op=ai_usage&days=7').catch(() => ({ records: [] })),
      ]);
      setOverview(ov);
      setTenants(t.items || []);
      setPlans(p.items || []);
      setAudit(au.items || []);
      setAiUsage(ai.records || []);
    } catch (e: any) {
      toast.error('Failed: ' + e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function suspend(id: string) {
    try {
      await apiPost('/api/super-admin?op=suspend', { tenantId: id });
      toast.success('Tenant suspended');
      await load();
    } catch (e: any) { toast.error(e.message); }
  }

  async function activate(id: string) {
    try {
      await apiPost('/api/super-admin?op=activate', { tenantId: id });
      toast.success('Tenant activated');
      await load();
    } catch (e: any) { toast.error(e.message); }
  }

  if (loading) {
    return <div className="space-y-3"><Skeleton className="h-8 w-48" /><Skeleton className="h-64" /></div>;
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <Shield className="h-6 w-6 text-primary" /> Super Admin
        </h1>
        <p className="text-sm text-muted-foreground">Platform-level control. Tenant users cannot access this page.</p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="tenants">Tenants</TabsTrigger>
          <TabsTrigger value="plans">Plans</TabsTrigger>
          <TabsTrigger value="settings">Platform Settings</TabsTrigger>
          <TabsTrigger value="audit">Audit</TabsTrigger>
          <TabsTrigger value="ai_usage">AI Usage</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <MetricCard icon={Building2} label="Tenants" value={overview?.tenants ?? 0} />
            <MetricCard icon={Shield} label="Users" value={overview?.users ?? 0} />
            <MetricCard icon={CreditCard} label="Plans" value={overview?.plans ?? 0} />
            <MetricCard icon={Cpu} label="AI calls (all-time)" value={overview?.aiCalls ?? 0} />
          </div>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Platform health</CardTitle>
              <CardDescription className="text-xs">Cross-tenant statistics and security posture.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
                <Stat label="Active tenants" value={tenants.filter((t) => t.status === 'active' || t.status === 'trial').length} />
                <Stat label="Suspended" value={tenants.filter((t) => t.status === 'suspended').length} />
                <Stat label="On trial" value={tenants.filter((t) => t.status === 'trial').length} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tenants" className="space-y-3">
          <Card>
            <CardContent className="p-0">
              {tenants.length === 0 ? (
                <p className="p-8 text-center text-muted-foreground text-sm">No tenants yet.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="text-left px-4 py-2.5 font-medium">Name</th>
                      <th className="text-left px-4 py-2.5 font-medium">Slug</th>
                      <th className="text-left px-4 py-2.5 font-medium">Plan</th>
                      <th className="text-left px-4 py-2.5 font-medium">Status</th>
                      <th className="text-left px-4 py-2.5 font-medium">Users</th>
                      <th className="text-left px-4 py-2.5 font-medium">Created</th>
                      <th className="text-right px-4 py-2.5 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tenants.map((t) => (
                      <tr key={t.id} className="border-b hover:bg-muted/30">
                        <td className="px-4 py-2.5">{t.name}</td>
                        <td className="px-4 py-2.5 text-xs font-mono">{t.slug}</td>
                        <td className="px-4 py-2.5">{t.plan?.name || '—'}</td>
                        <td className="px-4 py-2.5">
                          <Badge variant="secondary" className={
                            t.status === 'active' ? 'bg-green-100 text-green-900' :
                            t.status === 'trial' ? 'bg-amber-100 text-amber-900' :
                            t.status === 'suspended' ? 'bg-red-100 text-red-900' : ''
                          }>{t.status}</Badge>
                        </td>
                        <td className="px-4 py-2.5">{t._count.users}</td>
                        <td className="px-4 py-2.5 text-xs text-muted-foreground">{formatDateTime(t.createdAt)}</td>
                        <td className="px-4 py-2.5 text-right">
                          {t.status === 'suspended' ? (
                            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => activate(t.id)}>
                              <Check className="h-3 w-3" />
                            </Button>
                          ) : (
                            <Button size="sm" variant="ghost" className="h-7 text-destructive text-xs" onClick={() => suspend(t.id)}>
                              <Power className="h-3 w-3" />
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="plans" className="space-y-3">
          <Card>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="text-left px-4 py-2.5 font-medium">Name</th>
                    <th className="text-left px-4 py-2.5 font-medium">Monthly</th>
                    <th className="text-left px-4 py-2.5 font-medium">Yearly</th>
                    <th className="text-left px-4 py-2.5 font-medium">Trial</th>
                    <th className="text-left px-4 py-2.5 font-medium">Max users</th>
                    <th className="text-left px-4 py-2.5 font-medium">AI calls</th>
                    <th className="text-left px-4 py-2.5 font-medium">Default</th>
                  </tr>
                </thead>
                <tbody>
                  {plans.map((p) => (
                    <tr key={p.id} className="border-b hover:bg-muted/30">
                      <td className="px-4 py-2.5 font-medium">{p.name}</td>
                      <td className="px-4 py-2.5">₹{p.priceMonthly / 100}</td>
                      <td className="px-4 py-2.5">₹{p.priceYearly / 100}</td>
                      <td className="px-4 py-2.5">{p.trialDays}d</td>
                      <td className="px-4 py-2.5">{p.maxUsers}</td>
                      <td className="px-4 py-2.5">{p.maxAiCalls}</td>
                      <td className="px-4 py-2.5">{p.isDefault ? <Badge variant="secondary">default</Badge> : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
          <p className="text-xs text-muted-foreground">To edit plans, use the API or contact engineering. (UI plan editor coming soon.)</p>
        </TabsContent>

        <TabsContent value="settings" className="space-y-3">
          <PlatformSettingsCard />
        </TabsContent>

        <TabsContent value="audit" className="space-y-3">
          <Card>
            <CardContent className="p-0">
              <div className="max-h-[60vh] overflow-y-auto custom-scrollbar">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-muted/30">
                    <tr className="border-b">
                      <th className="text-left px-4 py-2.5 font-medium">When</th>
                      <th className="text-left px-4 py-2.5 font-medium">Tenant</th>
                      <th className="text-left px-4 py-2.5 font-medium">Action</th>
                      <th className="text-left px-4 py-2.5 font-medium">Entity</th>
                      <th className="text-left px-4 py-2.5 font-medium">Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {audit.map((a) => (
                      <tr key={a.id} className="border-b hover:bg-muted/30">
                        <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap">{formatDateTime(a.createdAt)}</td>
                        <td className="px-4 py-2.5 text-xs">{a.tenant?.name || '—'}</td>
                        <td className="px-4 py-2.5"><Badge variant="secondary" className="text-[10px]">{a.action}</Badge></td>
                        <td className="px-4 py-2.5 text-xs">{a.entity || '—'}</td>
                        <td className="px-4 py-2.5 text-xs">{a.details || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ai_usage" className="space-y-3">
          <Card>
            <CardContent className="p-0">
              <div className="max-h-[60vh] overflow-y-auto custom-scrollbar">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-muted/30">
                    <tr className="border-b">
                      <th className="text-left px-4 py-2.5 font-medium">When</th>
                      <th className="text-left px-4 py-2.5 font-medium">Provider</th>
                      <th className="text-left px-4 py-2.5 font-medium">Feature</th>
                      <th className="text-left px-4 py-2.5 font-medium">Latency</th>
                      <th className="text-left px-4 py-2.5 font-medium">Status</th>
                      <th className="text-left px-4 py-2.5 font-medium">Tenant</th>
                    </tr>
                  </thead>
                  <tbody>
                    {aiUsage.length === 0 ? (
                      <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground text-sm">No AI calls in the last 7 days.</td></tr>
                    ) : (
                      aiUsage.slice(0, 200).map((r) => (
                        <tr key={r.id} className="border-b hover:bg-muted/30">
                          <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap">{formatDateTime(r.createdAt)}</td>
                          <td className="px-4 py-2.5"><Badge variant="outline" className="text-[10px]">{r.provider}</Badge></td>
                          <td className="px-4 py-2.5 text-xs">{r.feature}</td>
                          <td className="px-4 py-2.5 text-xs">{r.latencyMs}ms</td>
                          <td className="px-4 py-2.5">
                            <Badge variant="secondary" className={`text-[10px] ${r.success ? 'bg-green-100 text-green-900' : 'bg-red-100 text-red-900'}`}>
                              {r.success ? 'ok' : 'fail'}
                            </Badge>
                          </td>
                          <td className="px-4 py-2.5 text-xs font-mono">{r.tenantId?.slice(0, 8) || '—'}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function MetricCard({ icon: Icon, label, value }: { icon: any; label: string; value: number | string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-1.5 mb-1.5">
          <Icon className="h-3.5 w-3.5 text-primary" />
          <span className="text-[10px] uppercase tracking-wider font-medium">{label}</span>
        </div>
        <div className="text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="border rounded-md p-2.5">
      <div className="text-[10px] uppercase text-muted-foreground tracking-wider">{label}</div>
      <div className="text-lg font-semibold mt-0.5">{value}</div>
    </div>
  );
}

function PlatformSettingsCard() {
  const [contact, setContact] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [whatsapp, setWhatsapp] = useState('');
  const [email, setEmail] = useState('');
  const [upi, setUpi] = useState('');
  const [upiName, setUpiName] = useState('');

  async function load() {
    setLoading(true);
    try {
      const [contactRes, upiRes] = await Promise.all([
        apiGet('/api/super-admin/contact'),
        apiGet('/api/super-admin/upi-receiver'),
      ]);
      setContact(contactRes);
      setWhatsapp(contactRes.whatsappNumber || '');
      setEmail(contactRes.contactEmail || '');
      setUpi(upiRes.upiReceiver === 'NOT_CONFIGURED' ? '' : upiRes.upiReceiver);
      setUpiName(upiRes.upiReceiverName || '');
    } catch (e: any) {
      toast.error('Failed: ' + e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function saveContact() {
    setSaving(true);
    try {
      await apiPost('/api/super-admin/contact', {
        whatsappNumber: whatsapp || undefined,
        contactEmail: email || undefined,
      });
      toast.success('Contact info saved');
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function saveUpi() {
    setSaving(true);
    try {
      await apiPost('/api/super-admin/upi-receiver', { upiReceiver: upi });
      toast.success('UPI receiver saved');
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <Skeleton className="h-64" />;

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Wallet className="h-4 w-4 text-primary" /> UPI Receiver for subscription payments</CardTitle>
          <CardDescription className="text-xs">Customers pay subscription fees to this UPI ID. NO hardcoded default — set your own.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label className="text-xs">UPI ID (name@bank or 10-digit mobile)</Label>
            <Input value={upi} onChange={(e) => setUpi(e.target.value.trim())} placeholder="yourname@bank" />
          </div>
          <div>
            <Label className="text-xs">Display name (shown on customer payment screen)</Label>
            <Input value={upiName} onChange={(e) => setUpiName(e.target.value)} placeholder="Your Business Name" />
          </div>
          <Button onClick={saveUpi} disabled={saving || upi.length < 5}>
            {saving ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : null}
            Save UPI receiver
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Smartphone className="h-4 w-4 text-primary" /> Super Admin contact (for password recovery)</CardTitle>
          <CardDescription className="text-xs">Used to send WhatsApp OTP during password recovery. NO hardcoded default — set your own.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label className="text-xs"><Mail className="h-3 w-3 inline mr-1" /> Contact email</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@business.com" />
          </div>
          <div>
            <Label className="text-xs"><Smartphone className="h-3 w-3 inline mr-1" /> WhatsApp number (10-15 digits, no +)</Label>
            <Input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value.replace(/[^0-9]/g, ''))} placeholder="Your WhatsApp number" maxLength={15} />
          </div>
          <Button onClick={saveContact} disabled={saving || (whatsapp.length > 0 && whatsapp.length < 10)}>
            {saving ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : null}
            Save contact info
          </Button>
        </CardContent>
      </Card>

      <Card className="bg-amber-50 border-amber-200">
        <CardContent className="p-3 text-xs text-amber-900">
          <p className="font-medium mb-1">⚠ Zero hardcoded credentials policy</p>
          <p>OPERA AI contains NO hardcoded super admin credentials, NO default UPI receiver, NO default WhatsApp number. You must set all sensitive values via this UI. Plans remain as templates (Super Admin can edit/create via API).</p>
        </CardContent>
      </Card>
    </>
  );
}
