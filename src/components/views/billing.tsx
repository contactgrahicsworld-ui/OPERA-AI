'use client';

import { useEffect, useState } from 'react';
import { apiGet, apiPost, formatINR, paiseToINR, formatDate, formatDateTime } from '@/lib/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Wallet, Smartphone, Receipt, CheckCircle, Loader2, ArrowRight, FileText, Crown } from 'lucide-react';
import { toast } from 'sonner';

interface BillingData {
  plans: any[];
  upiReceiver: string;
  upiReceiverName: string;
  currentSubscription: any;
  tenantStatus: string;
  trialEndsAt: string;
  recentPayments: any[];
  myInvoices: any[];
}

export function BillingView() {
  const [data, setData] = useState<BillingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [initiateOpen, setInitiateOpen] = useState(false);
  const [utrOpen, setUtrOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<any | null>(null);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly' | 'custom'>('yearly');
  const [customDuration, setCustomDuration] = useState(30);
  const [paymentResp, setPaymentResp] = useState<any | null>(null);
  const [utrValue, setUtrValue] = useState('');
  const [pendingPaymentId, setPendingPaymentId] = useState('');

  async function load() {
    setLoading(true);
    try {
      const d = await apiGet<BillingData>('/api/billing');
      setData(d);
    } catch (e: any) {
      toast.error('Failed to load billing: ' + e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function initiatePayment(plan: any, cycle: 'monthly' | 'yearly' | 'custom') {
    setBusy(true);
    try {
      const res = await apiPost('/api/billing/payments', {
        planId: plan.id,
        billingCycle: cycle,
        ...(cycle === 'custom' ? { customDurationDays: customDuration } : {}),
      });
      if (res.ok) {
        setPaymentResp(res);
        setInitiateOpen(true);
        toast.success('Payment initiated. UPI details shown below.');
      } else {
        toast.error(res.error || 'Failed to initiate');
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function submitUtr() {
    setBusy(true);
    try {
      const res = await apiPost('/api/billing/submit-utr', {
        paymentId: pendingPaymentId,
        utr: utrValue,
      });
      if (res.ok) {
        toast.success('UTR submitted. Super Admin will verify and activate your subscription.');
        setUtrOpen(false);
        setUtrValue('');
        setPendingPaymentId('');
        await load();
      } else {
        toast.error(res.error || 'Failed to submit UTR');
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }

  if (loading || !data) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  const isTrial = data.tenantStatus === 'trial';
  const trialEnds = data.trialEndsAt ? new Date(data.trialEndsAt) : null;
  const trialRemaining = trialEnds ? Math.ceil((trialEnds.getTime() - Date.now()) / (24 * 60 * 60 * 1000)) : 0;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <Wallet className="h-6 w-6 text-primary" /> Billing & Subscription
        </h1>
        <p className="text-sm text-muted-foreground">Manage your subscription, payments, and invoices.</p>
      </div>

      {/* Current subscription status */}
      <Card className={`border-l-4 ${data.currentSubscription?.status === 'active' ? 'border-l-green-500' : isTrial ? 'border-l-amber-500' : 'border-l-red-500'}`}>
        <CardContent className="p-4">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Current Plan</div>
              <div className="text-xl font-bold">{data.currentSubscription?.plan || (isTrial ? 'Starter (Trial)' : 'No Plan')}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Status</div>
              <Badge variant="secondary" className={
                data.currentSubscription?.status === 'active' ? 'bg-green-100 text-green-900' :
                isTrial ? 'bg-amber-100 text-amber-900' : 'bg-red-100 text-red-900'
              }>
                {data.currentSubscription?.status || data.tenantStatus}
              </Badge>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{isTrial ? 'Trial ends in' : 'Subscription ends'}</div>
              <div className="font-semibold text-sm">
                {data.currentSubscription?.endsAt ? formatDate(data.currentSubscription.endsAt) :
                 trialEnds ? `${formatDate(trialEnds)} (${trialRemaining}d left)` : '—'}
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Amount</div>
              <div className="font-semibold text-sm">
                ₹{formatINR(paiseToINR(data.currentSubscription?.amount || 0))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Available plans */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Available plans</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {data.plans.map((plan: any) => (
            <Card key={plan.id} className={plan.isDefault ? 'border-primary' : ''}>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="font-semibold">{plan.name}</div>
                  {plan.isDefault && <Badge variant="secondary" className="text-[10px] bg-primary/10 text-primary">default</Badge>}
                </div>
                <div className="text-2xl font-bold">
                  ₹{formatINR(paiseToINR(plan.priceMonthly))}
                  <span className="text-xs text-muted-foreground font-normal">/mo</span>
                </div>
                <div className="text-xs text-muted-foreground">Or ₹{formatINR(paiseToINR(plan.priceYearly))}/year</div>
                <p className="text-xs text-muted-foreground line-clamp-2 min-h-[2.5rem]">{plan.description}</p>
                <div className="text-[10px] text-muted-foreground">
                  {plan.trialDays}d trial · {plan.maxUsers} users · {plan.maxAiCalls} AI calls
                </div>
                <Button
                  size="sm"
                  variant={plan.isDefault ? 'default' : 'outline'}
                  onClick={() => { setSelectedPlan(plan); setBillingCycle('yearly'); setPaymentResp(null); setInitiateOpen(true); }}
                  disabled={busy}
                  className="w-full"
                >
                  <Crown className="h-3.5 w-3.5 mr-1" /> Choose {plan.name}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Recent payments */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Receipt className="h-4 w-4 text-primary" /> Recent payments</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {(data.recentPayments || []).length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">
              <Receipt className="h-8 w-8 mx-auto mb-2 opacity-40" />
              <p>No payments yet. Choose a plan above to get started.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="text-left px-4 py-2.5 font-medium">Plan</th>
                  <th className="text-left px-4 py-2.5 font-medium">Amount</th>
                  <th className="text-left px-4 py-2.5 font-medium">UTR</th>
                  <th className="text-left px-4 py-2.5 font-medium">Status</th>
                  <th className="text-left px-4 py-2.5 font-medium">Invoice</th>
                  <th className="text-left px-4 py-2.5 font-medium">Date</th>
                  <th className="text-right px-4 py-2.5 font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {(data.recentPayments || []).map((p: any) => (
                  <tr key={p.id} className="border-b hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium">{p.planNameSnapshot}</td>
                    <td className="px-4 py-3">₹{formatINR(paiseToINR(p.finalAmountSnapshot))}</td>
                    <td className="px-4 py-3 text-xs font-mono">{p.utr || '—'}</td>
                    <td className="px-4 py-3">
                      <Badge variant="secondary" className={
                        p.status === 'VERIFIED' ? 'bg-green-100 text-green-900' :
                        p.status === 'REJECTED' ? 'bg-red-100 text-red-900' :
                        p.status === 'REFUNDED' ? 'bg-amber-100 text-amber-900' :
                        'bg-amber-100 text-amber-900'
                      }>{p.status}</Badge>
                    </td>
                    <td className="px-4 py-3 text-xs">{p.invoiceNumber || '—'}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{formatDate(p.createdAt)}</td>
                    <td className="px-4 py-3 text-right">
                      {p.status === 'PENDING' && !p.utr && (
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => {
                          setPendingPaymentId(p.id);
                          setUtrValue('');
                          setUtrOpen(true);
                        }}>
                          Submit UTR
                        </Button>
                      )}
                      {p.invoiceNumber && (
                        <a href={`/api/invoices/view?id=${p.id}`} target="_blank" rel="noreferrer">
                          <Button size="sm" variant="ghost" className="h-7 text-xs">
                            <FileText className="h-3 w-3 mr-1" /> View invoice
                          </Button>
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* My invoices */}
      {(data.myInvoices || []).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><FileText className="h-4 w-4 text-primary" /> My invoices</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="text-left px-4 py-2.5 font-medium">Invoice #</th>
                  <th className="text-left px-4 py-2.5 font-medium">Plan</th>
                  <th className="text-left px-4 py-2.5 font-medium">Amount</th>
                  <th className="text-left px-4 py-2.5 font-medium">Period</th>
                  <th className="text-left px-4 py-2.5 font-medium">WhatsApp</th>
                  <th className="text-right px-4 py-2.5 font-medium">View</th>
                </tr>
              </thead>
              <tbody>
                {(data.myInvoices || []).map((inv: any) => (
                  <tr key={inv.id} className="border-b hover:bg-muted/30">
                    <td className="px-4 py-3 font-mono text-xs">{inv.invoiceNumber}</td>
                    <td className="px-4 py-3">{inv.planName}</td>
                    <td className="px-4 py-3">₹{formatINR(paiseToINR(inv.totalWithTax || inv.finalAmount))}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {formatDate(inv.startDate)} → {formatDate(inv.expiryDate)}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="secondary" className="text-[10px]">{inv.whatsappStatus}</Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <a href={`/api/invoices/view?id=${inv.id}`} target="_blank" rel="noreferrer">
                        <Button size="sm" variant="ghost" className="h-7 text-xs">Open</Button>
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* Payment initiation modal */}
      <Dialog open={initiateOpen} onOpenChange={setInitiateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Smartphone className="h-4 w-4 text-primary" /> Pay via UPI</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {!paymentResp && (
              <>
                {selectedPlan && (
                  <div className="bg-muted/30 rounded-md p-3 space-y-1">
                    <div className="flex justify-between"><span className="text-xs text-muted-foreground">Plan</span><span className="font-medium">{selectedPlan.name}</span></div>
                    <div className="flex justify-between"><span className="text-xs text-muted-foreground">Price (monthly)</span><span>₹{formatINR(paiseToINR(selectedPlan.priceMonthly))}</span></div>
                    <div className="flex justify-between"><span className="text-xs text-muted-foreground">Price (yearly)</span><span>₹{formatINR(paiseToINR(selectedPlan.priceYearly))}</span></div>
                  </div>
                )}
                <div>
                  <Label className="text-xs">Billing cycle</Label>
                  <div className="grid grid-cols-3 gap-2 mt-1">
                    {(['monthly', 'yearly', 'custom'] as const).map((c) => (
                      <button
                        key={c}
                        onClick={() => setBillingCycle(c)}
                        className={`text-xs py-2 rounded-md border ${billingCycle === c ? 'border-primary bg-primary/10 text-primary' : 'border-border'}`}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </div>
                {billingCycle === 'custom' && (
                  <div>
                    <Label className="text-xs">Custom duration (days, 7-730)</Label>
                    <Input type="number" min={7} max={730} value={customDuration} onChange={(e) => setCustomDuration(Math.min(730, Math.max(7, Number(e.target.value))))} />
                  </div>
                )}
                <Button onClick={() => selectedPlan && initiatePayment(selectedPlan, billingCycle)} disabled={busy} className="w-full">
                  {busy ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Initiating…</> : <>Generate UPI details <ArrowRight className="h-4 w-4 ml-1" /></>}
                </Button>
              </>
            )}
            {paymentResp && (
              <>
                <div className="bg-green-50 border border-green-200 text-green-900 rounded-md p-3 space-y-1">
                  <div className="flex justify-between"><span className="text-xs">Plan</span><span className="font-medium">{paymentResp.plan}</span></div>
                  <div className="flex justify-between"><span className="text-xs">Duration</span><span>{paymentResp.durationDays} days</span></div>
                  <div className="flex justify-between"><span className="text-xs">Final amount</span><span className="text-lg font-bold">₹{formatINR(paiseToINR(paymentResp.finalAmount))}</span></div>
                  <div className="flex justify-between"><span className="text-xs">UPI receiver</span><span className="font-mono text-xs">{paymentResp.upiReceiver}</span></div>
                </div>
                <div className="text-center">
                  <div className="inline-block p-4 bg-white border-2 border-primary rounded-lg">
                    <div className="font-mono text-xs text-muted-foreground">{paymentResp.upiReceiverName}</div>
                    <div className="font-bold text-lg">{paymentResp.upiReceiver}</div>
                    <div className="text-xs text-muted-foreground mt-1">Scan or copy this UPI ID</div>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground text-center">
                  Pay ₹{formatINR(paiseToINR(paymentResp.finalAmount))} to the UPI ID above, then submit your UTR below.
                </p>
                <Button onClick={() => {
                  setInitiateOpen(false);
                  setPendingPaymentId(paymentResp.paymentId);
                  setUtrValue('');
                  setUtrOpen(true);
                  setPaymentResp(null);
                }} className="w-full">
                  I have paid — Submit UTR
                </Button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* UTR submission modal */}
      <Dialog open={utrOpen} onOpenChange={(o) => { setUtrOpen(o); if (!o) { setPendingPaymentId(''); setUtrValue(''); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Receipt className="h-4 w-4 text-primary" /> Submit UTR</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Enter the UTR (Unique Transaction Reference) from your bank/UPI app after paying.
              Super Admin will verify and activate your subscription.
            </p>
            <div>
              <Label className="text-xs">UTR (alphanumeric, 8-30 chars)</Label>
              <Input value={utrValue} onChange={(e) => setUtrValue(e.target.value.replace(/[^A-Za-z0-9]/g, '').slice(0, 30))} placeholder="UTR123456789" />
            </div>
            <div className="text-[10px] text-muted-foreground bg-amber-50 border border-amber-200 text-amber-900 rounded-md p-2.5">
              ⚠ Duplicate UTRs are rejected. Submitting UTR alone does NOT activate your subscription — Super Admin verification is required.
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUtrOpen(false)}>Cancel</Button>
            <Button onClick={submitUtr} disabled={busy || utrValue.length < 8}>
              {busy ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : null}
              Submit UTR
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
