'use client';

import { useEffect, useState } from 'react';
import { apiGet, formatINR, paiseToINR } from '@/lib/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { BarChart3, TrendingUp, TrendingDown, Wallet, Users, FileText } from 'lucide-react';
import { toast } from 'sonner';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar, PieChart, Pie, Cell, Legend,
} from 'recharts';

interface AnalyticsData {
  range: string;
  days: number;
  totals: { revenue: number; expenses: number; leads: number; quotations: number; quotationValue: number };
  snapshot: any;
  daily: { date: string; revenue: number; expenses: number; leads: number }[];
  leadsBySource: { source: string; _count: number }[];
  leadsByStage: Record<string, number>;
  quotationsByStatus: Record<string, number>;
}

const COLORS = ['#0d9488', '#f59e0b', '#ef4444', '#10b981', '#8b5cf6'];

export function AnalyticsView() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const d = await apiGet<AnalyticsData>('/api/analytics?range=30d');
      setData(d);
    } catch (e: any) {
      toast.error('Failed: ' + e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  if (loading || !data) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  const rev = paiseToINR(data.totals.revenue);
  const exp = paiseToINR(data.totals.expenses);
  const profit = rev - exp;
  const margin = rev > 0 ? ((profit / rev) * 100).toFixed(1) : '0.0';

  const stageData = Object.entries(data.leadsByStage || {}).map(([name, value]) => ({ name, value }));
  const sourceData = (data.leadsBySource || []).map((s) => ({ name: s.source || 'unknown', value: s._count }));
  const quotData = Object.entries(data.quotationsByStatus || {}).map(([name, value]) => ({ name, value }));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <BarChart3 className="h-6 w-6 text-primary" /> Analytics
        </h1>
        <p className="text-sm text-muted-foreground">Last 30 days · AI-explained trends.</p>
      </div>

      {/* Top KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard icon={Wallet} label="Revenue" value={`₹${formatINR(rev)}`} tone="green" />
        <KpiCard icon={TrendingDown} label="Expenses" value={`₹${formatINR(exp)}`} tone="red" />
        <KpiCard icon={TrendingUp} label="Net margin" value={`${margin}%`} sub={`₹${formatINR(profit)}`} tone={profit >= 0 ? 'green' : 'red'} />
        <KpiCard icon={Users} label="New leads" value={data.totals.leads} tone="blue" />
      </div>

      {/* AI explanation */}
      {data.snapshot && data.snapshot.paymentsTotalLastMonth > 0 && (
        <Card className="border-l-4 border-l-primary">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                <BarChart3 className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-medium">AI explanation</p>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {data.snapshot.paymentsTotalThisMonth >= data.snapshot.paymentsTotalLastMonth
                    ? `Revenue increased ${(((data.snapshot.paymentsTotalThisMonth - data.snapshot.paymentsTotalLastMonth) / data.snapshot.paymentsTotalLastMonth) * 100).toFixed(1)}% compared with last month. Supporting records: ${data.snapshot.paymentsTotalThisMonth} paise collected vs ${data.snapshot.paymentsTotalLastMonth} paise last month.`
                    : `Revenue decreased ${(((data.snapshot.paymentsTotalLastMonth - data.snapshot.paymentsTotalThisMonth) / data.snapshot.paymentsTotalLastMonth) * 100).toFixed(1)}% compared with last month. Investigate lost deals, slower collection, or reduced lead flow.`}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Revenue & expenses trend */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Revenue vs expenses (last {data.days} days)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.daily}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(d) => d.slice(5)} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `₹${(v / 100).toFixed(0)}`} />
                <Tooltip formatter={(v: number) => `₹${formatINR(paiseToINR(v))}`} labelFormatter={(l) => `Date: ${l}`} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2} name="Revenue" dot={false} />
                <Line type="monotone" dataKey="expenses" stroke="#ef4444" strokeWidth={2} name="Expenses" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Two-col charts */}
      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Leads by stage</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stageData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#0d9488" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Leads by source</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              {sourceData.length === 0 ? (
                <div className="h-full flex items-center justify-center text-muted-foreground text-sm">No data</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={sourceData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, value }) => `${name}: ${value}`}>
                      {sourceData.map((_, idx) => <Cell key={idx} fill={COLORS[idx % COLORS.length]} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quotation status */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Quotations by status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={quotData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="value" fill="#f59e0b" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Snapshot table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Current business snapshot</CardTitle>
          <CardDescription>Live counts at a glance.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
            <Stat label="Total leads" value={data.snapshot?.leadsTotal || 0} />
            <Stat label="Leads need follow-up" value={data.snapshot?.leadsNeedingFollowup || 0} />
            <Stat label="Total customers" value={data.snapshot?.customersTotal || 0} />
            <Stat label="Inactive customers" value={data.snapshot?.customersInactive || 0} />
            <Stat label="Quotations waiting" value={`₹${formatINR(paiseToINR(data.snapshot?.quotationsAmountWaiting || 0))}`} />
            <Stat label="Stale quotations" value={data.snapshot?.quotationsStaleCount || 0} />
            <Stat label="Overdue payments" value={data.snapshot?.paymentsOverdueCount || 0} />
            <Stat label="Overdue amount" value={`₹${formatINR(paiseToINR(data.snapshot?.paymentsOverdueAmount || 0))}`} />
            <Stat label="Open tasks" value={data.snapshot?.tasksOpen || 0} />
            <Stat label="Overdue tasks" value={data.snapshot?.tasksOverdue || 0} />
            <Stat label="Low-stock items" value={data.snapshot?.lowStockCount || 0} />
            <Stat label="Receivables" value={`₹${formatINR(paiseToINR(data.snapshot?.receivablesOutstanding || 0))}`} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function KpiCard({ icon: Icon, label, value, sub, tone }: { icon: any; label: string; value: string | number; sub?: string; tone: string }) {
  const tones: Record<string, string> = {
    green: 'bg-green-50 border-green-200 text-green-900',
    red: 'bg-red-50 border-red-200 text-red-900',
    blue: 'bg-blue-50 border-blue-200 text-blue-900',
    violet: 'bg-violet-50 border-violet-200 text-violet-900',
  };
  const iconTones: Record<string, string> = {
    green: 'text-green-600', red: 'text-red-600', blue: 'text-blue-600', violet: 'text-violet-600',
  };
  return (
    <Card className={tones[tone]}>
      <CardContent className="p-4">
        <div className="flex items-center gap-1.5 mb-1.5">
          <Icon className={`h-3.5 w-3.5 ${iconTones[tone]}`} />
          <span className="text-[10px] uppercase tracking-wider font-medium">{label}</span>
        </div>
        <div className="text-2xl font-bold leading-tight">{value}</div>
        {sub && <div className="text-[10px] opacity-80 mt-0.5">{sub}</div>}
      </CardContent>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="border rounded-md p-2.5">
      <div className="text-[10px] uppercase text-muted-foreground tracking-wider">{label}</div>
      <div className="text-lg font-semibold mt-0.5">{value}</div>
    </div>
  );
}
