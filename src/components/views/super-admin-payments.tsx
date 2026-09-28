'use client';

import { useEffect, useState } from 'react';
import { apiGet, apiPost, formatINR, paiseToINR, formatDate, formatDateTime } from '@/lib/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Wallet, Check, X, RefreshCw, FileText, Eye, Receipt, Smartphone } from 'lucide-react';
import { toast } from 'sonner';

interface PaymentsData {
  items: any[];
  summary: any;
}

export function SuperAdminPaymentsView() {
  const [data, setData] = useState<PaymentsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('PENDING');
  const [rejectOpen, setRejectOpen] = useState<any | null>(null);
  const [refundOpen, setRefundOpen] = useState<any | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [refundAmount, setRefundAmount] = useState(0);
  const [refundReason, setRefundReason] = useState('');
  const [busy, setBusy] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const d = await apiGet<PaymentsData>(`/api/super-admin/payments?status=${filter}`);
      setData(d);
    } catch (e: any) {
      toast.error('Failed to load: ' + e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const id = setTimeout(load, 200);
    return () => clearTimeout(id);
  }, [filter]);

  async function verify(paymentId: string) {
    if (!confirm('Verify this payment? This will activate the subscription and generate an invoice.')) return;
    setBusy(true);
    try {
      const res = await apiPost('/api/super-admin/verify-utr', { paymentId });
      if (res.ok) {
        toast.success(`Verified. Invoice ${res.invoiceNumber} generated. WhatsApp: ${res.whatsappStatus}`);
        await load();
      } else {
        toast.error(res.error || 'Verification failed');
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function reject() {
    if (!rejectOpen || rejectReason.length < 5) return;
    setBusy(true);
    try {
      const res = await apiPost('/api/super-admin/reject-payment', { paymentId: rejectOpen.id, reason: rejectReason });
      if (res.ok) {
        toast.success('Payment rejected');
        setRejectOpen(null);
        setRejectReason('');
        await load();
      } else {
        toast.error(res.error || 'Reject failed');
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function refund() {
    if (!refundOpen || refundAmount <= 0 || refundReason.length < 5) return;
    setBusy(true);
    try {
      const res = await apiPost('/api/super-admin/refund-payment', {
        paymentId: refundOpen.id,
        refundAmount,
        refundReason,
      });
      if (res.ok) {
        toast.success(`Refund processed (₹${formatINR(paiseToINR(refundAmount))}). Tenant suspended.`);
        setRefundOpen(null);
        setRefundAmount(0);
        setRefundReason('');
        await load();
      } else {
        toast.error(res.error || 'Refund failed');
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function retryWhatsapp(invoiceId: string) {
    setBusy(true);
    try {
      const res = await apiPost('/api/super-admin/retry-whatsapp', { invoiceId });
      toast.info(`WhatsApp status: ${res.whatsappStatus}`);
      await load();
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

  const s = data.summary || {};

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <Wallet className="h-6 w-6 text-primary" /> Payments Dashboard
        </h1>
        <p className="text-sm text-muted-foreground">Verify customer UTR submissions, generate invoices, manage refunds.</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Card className="bg-amber-50 border-amber-200 text-amber-900">
          <CardContent className="p-4">
            <div className="text-[10px] uppercase tracking-wider">Pending</div>
            <div className="text-2xl font-bold">{s.pending || 0}</div>
          </CardContent>
        </Card>
        <Card className="bg-green-50 border-green-200 text-green-900">
          <CardContent className="p-4">
            <div className="text-[10px] uppercase tracking-wider">Verified</div>
            <div className="text-2xl font-bold">{s.verified || 0}</div>
          </CardContent>
        </Card>
        <Card className="bg-red-50 border-red-200 text-red-900">
          <CardContent className="p-4">
            <div className="text-[10px] uppercase tracking-wider">Rejected</div>
            <div className="text-2xl font-bold">{s.rejected || 0}</div>
          </CardContent>
        </Card>
        <Card className="bg-violet-50 border-violet-200 text-violet-900">
          <CardContent className="p-4">
            <div className="text-[10px] uppercase tracking-wider">Refunded</div>
            <div className="text-2xl font-bold">{s.refunded || 0}</div>
          </CardContent>
        </Card>
        <Card className="bg-blue-50 border-blue-200 text-blue-900">
          <CardContent className="p-4">
            <div className="text-[10px] uppercase tracking-wider">Total collected</div>
            <div className="text-2xl font-bold">₹{formatINR(paiseToINR(s.totalAmountVerified || 0))}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Filter:</span>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="PENDING">PENDING</SelectItem>
            <SelectItem value="VERIFIED">VERIFIED</SelectItem>
            <SelectItem value="REJECTED">REJECTED</SelectItem>
            <SelectItem value="REFUNDED">REFUNDED</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      {/* Payments table */}
      <Card>
        <CardContent className="p-0">
          {(data.items || []).length === 0 ? (
            <div className="p-10 text-center text-muted-foreground">
              <Wallet className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p className="text-sm">No {filter.toLowerCase()} payments.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="text-left px-3 py-2.5 font-medium">Company</th>
                    <th className="text-left px-3 py-2.5 font-medium">Plan</th>
                    <th className="text-left px-3 py-2.5 font-medium">Amount</th>
                    <th className="text-left px-3 py-2.5 font-medium">UTR</th>
                    <th className="text-left px-3 py-2.5 font-medium">Submitted</th>
                    <th className="text-left px-3 py-2.5 font-medium">Invoice</th>
                    <th className="text-left px-3 py-2.5 font-medium">WhatsApp</th>
                    <th className="text-right px-3 py-2.5 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((p: any) => (
                    <tr key={p.id} className="border-b hover:bg-muted/30">
                      <td className="px-3 py-2.5">
                        <div className="font-medium text-xs">{p.tenant?.name || '—'}</div>
                        <div className="text-[10px] text-muted-foreground font-mono">{p.tenant?.slug}</div>
                      </td>
                      <td className="px-3 py-2.5 text-xs">{p.planNameSnapshot}<div className="text-[10px] text-muted-foreground">{p.durationDaysSnapshot}d · {p.billingCycleSnapshot}</div></td>
                      <td className="px-3 py-2.5 font-semibold text-xs">₹{formatINR(paiseToINR(p.finalAmountSnapshot))}<div className="text-[10px] font-normal text-muted-foreground line-through">₹{formatINR(paiseToINR(p.priceSnapshot))}</div></td>
                      <td className="px-3 py-2.5 text-xs font-mono">{p.utr || <span className="text-muted-foreground">no UTR</span>}</td>
                      <td className="px-3 py-2.5 text-[10px] text-muted-foreground">{p.utrSubmittedAt ? formatDateTime(p.utrSubmittedAt) : '—'}</td>
                      <td className="px-3 py-2.5 text-xs">
                        {p.invoice ? (
                          <a href={`/api/invoices/view?id=${p.invoice.id}`} target="_blank" rel="noreferrer" className="text-primary hover:underline">{p.invoice.invoiceNumber}</a>
                        ) : '—'}
                      </td>
                      <td className="px-3 py-2.5">
                        <Badge variant="secondary" className="text-[10px]">{p.whatsappStatus}</Badge>
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <div className="flex gap-1 justify-end">
                          {p.status === 'PENDING' && p.utr && (
                            <>
                              <Button size="sm" variant="default" className="h-7 text-xs" onClick={() => verify(p.id)} disabled={busy}>
                                <Check className="h-3 w-3" /> Verify
                              </Button>
                              <Button size="sm" variant="outline" className="h-7 text-xs text-destructive" onClick={() => { setRejectOpen(p); setRejectReason(''); }}>
                                <X className="h-3 w-3" />
                              </Button>
                            </>
                          )}
                          {p.status === 'VERIFIED' && (
                            <>
                              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { setRefundOpen(p); setRefundAmount(p.finalAmountSnapshot); setRefundReason(''); }}>
                                Refund
                              </Button>
                              {p.invoice && p.whatsappStatus !== 'DELIVERED' && (
                                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => retryWhatsapp(p.invoice.id)} disabled={busy}>
                                  <Smartphone className="h-3 w-3" /> Retry WA
                                </Button>
                              )}
                            </>
                          )}
                          {p.invoice && (
                            <a href={`/api/invoices/view?id=${p.invoice.id}`} target="_blank" rel="noreferrer">
                              <Button size="sm" variant="ghost" className="h-7 text-xs"><FileText className="h-3 w-3" /></Button>
                            </a>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Reject dialog */}
      <Dialog open={!!rejectOpen} onOpenChange={(o) => !o && setRejectOpen(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reject payment?</DialogTitle></DialogHeader>
          <div className="space-y-3">
            {rejectOpen && (
              <div className="text-xs bg-muted/30 rounded-md p-2.5">
                <div>{rejectOpen.tenant?.name}</div>
                <div className="text-muted-foreground">Plan: {rejectOpen.planNameSnapshot} · UTR: {rejectOpen.utr}</div>
              </div>
            )}
            <div>
              <Label className="text-xs">Reason (min 5 chars)</Label>
              <Textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(null)}>Cancel</Button>
            <Button variant="destructive" onClick={reject} disabled={busy || rejectReason.length < 5}>Reject</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Refund dialog */}
      <Dialog open={!!refundOpen} onOpenChange={(o) => !o && setRefundOpen(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Process refund?</DialogTitle></DialogHeader>
          <div className="space-y-3">
            {refundOpen && (
              <div className="text-xs bg-muted/30 rounded-md p-2.5">
                <div>{refundOpen.tenant?.name}</div>
                <div className="text-muted-foreground">Plan: {refundOpen.planNameSnapshot} · Final: ₹{formatINR(paiseToINR(refundOpen.finalAmountSnapshot))}</div>
              </div>
            )}
            <div>
              <Label className="text-xs">Refund amount (paise)</Label>
              <Input type="number" value={refundAmount} onChange={(e) => setRefundAmount(Number(e.target.value))} />
              <p className="text-[10px] text-muted-foreground mt-1">₹{formatINR(paiseToINR(refundAmount))} — max ₹{formatINR(paiseToINR(refundOpen?.finalAmountSnapshot || 0))}</p>
            </div>
            <div>
              <Label className="text-xs">Reason (min 5 chars)</Label>
              <Textarea value={refundReason} onChange={(e) => setRefundReason(e.target.value)} rows={3} />
            </div>
            <p className="text-[10px] text-amber-600">⚠ Refunding will SUSPEND the tenant's subscription immediately.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRefundOpen(null)}>Cancel</Button>
            <Button variant="destructive" onClick={refund} disabled={busy || refundAmount <= 0 || refundReason.length < 5 || refundAmount > (refundOpen?.finalAmountSnapshot || 0)}>Process refund</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
