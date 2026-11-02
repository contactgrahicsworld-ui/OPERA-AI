'use client';

import { useEffect, useState } from 'react';
import { apiGet, apiPost, apiPatch, formatDateTime, timeAgo } from '@/lib/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { MapPin, LogIn, LogOut, Plus, RefreshCw, Loader2, Users } from 'lucide-react';
import { toast } from 'sonner';

interface Visit {
  id: string;
  title: string;
  customerId?: string;
  leadId?: string;
  ownerId?: string;
  notes?: string;
  outcome?: string;
  checkInAt?: string;
  checkOutAt?: string;
  status: string;
  createdAt: string;
}

export function FieldSalesView() {
  const [visits, setVisits] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkinOpen, setCheckinOpen] = useState(false);
  const [checkoutVisit, setCheckoutVisit] = useState<Visit | null>(null);
  const [busy, setBusy] = useState(false);

  // Check-in form
  const [title, setTitle] = useState('');
  const [leadId, setLeadId] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [notes, setNotes] = useState('');
  const [captureGps, setCaptureGps] = useState(false);
  const [gps, setGps] = useState<{ lat?: number; lng?: number; accuracy?: number }>({});

  // Check-out form
  const [outcome, setOutcome] = useState('');
  const [checkoutNotes, setCheckoutNotes] = useState('');

  async function load() {
    setLoading(true);
    try {
      const data = await apiGet<{ items: Visit[]; total: number }>('/api/field-visits');
      setVisits(data.items || []);
    } catch (e: any) {
      toast.error('Failed: ' + e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function captureLocation() {
    if (!navigator.geolocation) {
      toast.error('Geolocation not supported by this browser');
      return;
    }
    setCaptureGps(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGps({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy });
        toast.success(`Location captured (accuracy: ${Math.round(pos.coords.accuracy)}m)`);
        setCaptureGps(false);
      },
      (err) => {
        toast.error('Location permission denied or unavailable');
        setCaptureGps(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  async function checkIn() {
    setBusy(true);
    try {
      await apiPost('/api/field-visits', {
        title,
        leadId: leadId || undefined,
        customerId: customerId || undefined,
        notes,
        latitude: gps.lat,
        longitude: gps.lng,
        locationAccuracy: gps.accuracy,
      });
      toast.success('Checked in');
      setCheckinOpen(false);
      setTitle(''); setLeadId(''); setCustomerId(''); setNotes(''); setGps({});
      await load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function checkOut() {
    if (!checkoutVisit) return;
    setBusy(true);
    try {
      await apiPatch('/api/field-visits', {
        visitId: checkoutVisit.id,
        outcome,
        notes: checkoutNotes,
      });
      toast.success('Checked out');
      setCheckoutVisit(null);
      setOutcome(''); setCheckoutNotes('');
      await load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <MapPin className="h-6 w-6 text-primary" /> Field Sales
          </h1>
          <p className="text-sm text-muted-foreground">Visit planning, check-in/check-out, location verification (where permitted).</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load}><RefreshCw className="h-4 w-4 mr-1.5" /> Refresh</Button>
          <Button size="sm" onClick={() => setCheckinOpen(true)}><Plus className="h-4 w-4 mr-1.5" /> Check in</Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {visits.length === 0 ? (
            <div className="p-10 text-center text-muted-foreground">
              <MapPin className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p className="text-sm">No field visits yet.</p>
              <p className="text-xs mt-1">Click "Check in" to start a visit.</p>
            </div>
          ) : (
            <div className="max-h-[calc(100vh-220px)] overflow-y-auto custom-scrollbar">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-muted/30">
                  <tr className="border-b">
                    <th className="text-left px-4 py-2.5 font-medium">Visit</th>
                    <th className="text-left px-4 py-2.5 font-medium">Check-in</th>
                    <th className="text-left px-4 py-2.5 font-medium">Check-out</th>
                    <th className="text-left px-4 py-2.5 font-medium">Outcome</th>
                    <th className="text-left px-4 py-2.5 font-medium">Status</th>
                    <th className="text-right px-4 py-2.5 font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {visits.map((v) => (
                    <tr key={v.id} className="border-b hover:bg-muted/30">
                      <td className="px-4 py-3">
                        <div className="font-medium text-xs">{v.title}</div>
                        {v.notes && <div className="text-[10px] text-muted-foreground line-clamp-1">{v.notes.split('\n')[0]}</div>}
                      </td>
                      <td className="px-4 py-3 text-xs">{v.checkInAt ? timeAgo(v.checkInAt) : '—'}</td>
                      <td className="px-4 py-3 text-xs">{v.checkOutAt ? timeAgo(v.checkOutAt) : '—'}</td>
                      <td className="px-4 py-3 text-xs">{v.outcome || '—'}</td>
                      <td className="px-4 py-3">
                        <Badge variant="secondary" className={
                          v.status === 'completed' ? 'bg-green-100 text-green-900' :
                          v.status === 'checked-in' ? 'bg-amber-100 text-amber-900' : ''
                        }>{v.status}</Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {v.status === 'checked-in' && (
                          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { setCheckoutVisit(v); setOutcome(''); setCheckoutNotes(''); }}>
                            <LogOut className="h-3 w-3 mr-1" /> Check out
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Check-in modal */}
      <Dialog open={checkinOpen} onOpenChange={setCheckinOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle className="flex items-center gap-2"><LogIn className="h-4 w-4 text-primary" /> Check in for field visit</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Visit title *</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Meeting with customer X" />
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Lead ID (optional)</Label>
                <Input value={leadId} onChange={(e) => setLeadId(e.target.value)} placeholder="cmul..." />
              </div>
              <div>
                <Label className="text-xs">Customer ID (optional)</Label>
                <Input value={customerId} onChange={(e) => setCustomerId(e.target.value)} placeholder="cmul..." />
              </div>
            </div>
            <div>
              <Label className="text-xs">Notes</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Visit purpose / agenda" />
            </div>
            <div className="flex items-center gap-2 text-xs">
              <Button size="sm" variant="outline" onClick={captureLocation} disabled={captureGps}>
                {captureGps ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <MapPin className="h-3 w-3 mr-1" />}
                Capture GPS location
              </Button>
              {gps.lat && (
                <span className="text-muted-foreground">
                  Location: {gps.lat.toFixed(4)}, {gps.lng?.toFixed(4)} (accuracy: {Math.round(gps.accuracy || 0)}m)
                </span>
              )}
            </div>
            <p className="text-[10px] text-muted-foreground">GPS is permission-based and minimized — only captured when you explicitly click the button.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCheckinOpen(false)}>Cancel</Button>
            <Button onClick={checkIn} disabled={busy || !title}>
              {busy ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : null}
              Check in
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Check-out modal */}
      <Dialog open={!!checkoutVisit} onOpenChange={(o) => !o && setCheckoutVisit(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle className="flex items-center gap-2"><LogOut className="h-4 w-4 text-primary" /> Check out</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="text-xs bg-muted/30 rounded-md p-2.5">
              <div className="font-medium">{checkoutVisit?.title}</div>
              <div className="text-muted-foreground">Check-in: {checkoutVisit?.checkInAt ? formatDateTime(checkoutVisit.checkInAt) : '—'}</div>
            </div>
            <div>
              <Label className="text-xs">Outcome *</Label>
              <Input value={outcome} onChange={(e) => setOutcome(e.target.value)} placeholder="e.g., Meeting successful — follow-up needed" />
            </div>
            <div>
              <Label className="text-xs">Check-out notes</Label>
              <Textarea value={checkoutNotes} onChange={(e) => setCheckoutNotes(e.target.value)} rows={3} placeholder="What happened? What's the next step?" />
            </div>
            <p className="text-[10px] text-muted-foreground">If outcome contains "follow", a follow-up task will be created automatically.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCheckoutVisit(null)}>Cancel</Button>
            <Button onClick={checkOut} disabled={busy || outcome.length < 2}>Check out</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
