'use client';

import { useEffect, useState, useCallback } from 'react';
import { apiGet, apiPost, formatINR, paiseToINR, timeAgo, formatDate } from '@/lib/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import {
  AlertTriangle, Phone, FileText, Wallet, CheckSquare, Boxes, Users, TrendingUp,
  Sparkles, RefreshCw, Loader2, Check, X, Play, Brain, ChevronRight,
} from 'lucide-react';

interface Snapshot {
  leadsTotal: number;
  leadsByStage: Record<string, number>;
  leadsNewToday: number;
  leadsNeedingFollowup: number;
  quotationsTotal: number;
  quotationsByStatus: Record<string, number>;
  quotationsAmountWaiting: number;
  quotationsStaleCount: number;
  quotationsStaleValue: number;
  customersTotal: number;
  customersActive: number;
  customersInactive: number;
  paymentsOverdueCount: number;
  paymentsOverdueAmount: number;
  paymentsTotalThisMonth: number;
  paymentsTotalLastMonth: number;
  tasksOpen: number;
  tasksOverdue: number;
  lowStockCount: number;
  staffActivitiesPending: number;
  expensesThisMonth: number;
  receivablesOutstanding: number;
  topOverduePayments: any[];
  topStaleQuotations: any[];
  topLeadsNeedingFollowup: any[];
  topLowStockProducts: any[];
  topOverdueTasks: any[];
}

interface ActionItem {
  id: string;
  title: string;
  description: string;
  category: string;
  priority: string;
  status: string;
  requiresApproval: boolean;
  riskLevel: string;
  insight?: { id: string; title: string; type: string; evidence: string; recommendedAction: string; confidence: number; uncertainty: string };
  createdAt: string;
}

interface InsightItem {
  id: string;
  title: string;
  type: string;
  priority: string;
  evidence: string;
  sourceRefs: string;
  recommendedAction: string;
  confidence: number;
  uncertainty: string;
  category: string;
  status: string;
  generatedAt: string;
}

export function ActionCenter() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [actions, setActions] = useState<ActionItem[]>([]);
  const [insights, setInsights] = useState<InsightItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [snap, ai] = await Promise.all([
        apiGet<Snapshot>('/api/ai/snapshot'),
        apiGet<{ actions: ActionItem[]; insights: InsightItem[] }>('/api/ai?limit=50'),
      ]);
      setSnapshot(snap);
      setActions(ai.actions || []);
      setInsights(ai.insights || []);
    } catch (e: any) {
      toast.error('Failed to load: ' + e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function regenerate() {
    setGenerating(true);
    try {
      const res = await apiPost<{ ok: boolean; insights: number; actions: number }>('/api/ai?op=generate');
      if (res.ok) {
        toast.success(`Generated ${res.insights} insights and ${res.actions} actions`);
        await load();
      }
    } catch (e: any) {
      toast.error('Generation failed: ' + e.message);
    } finally {
      setGenerating(false);
    }
  }

  async function approveAction(id: string) {
    try {
      await apiPost('/api/ai?op=approve', { actionId: id });
      toast.success('Approved');
      await load();
    } catch (e: any) { toast.error('Approve failed: ' + e.message); }
  }

  async function rejectAction(id: string) {
    try {
      await apiPost('/api/ai?op=reject', { actionId: id });
      toast.success('Rejected');
      await load();
    } catch (e: any) { toast.error('Reject failed: ' + e.message); }
  }

  async function executeAction(id: string) {
    try {
      const res = await apiPost<{ ok: boolean; result?: string; error?: string }>('/api/ai?op=execute', { actionId: id });
      if (res.ok) {
        toast.success(res.result || 'Executed');
      } else {
        toast.error(res.error || 'Execution failed');
      }
      await load();
    } catch (e: any) { toast.error('Execute failed: ' + e.message); }
  }

  async function dismissAction(id?: string, insightId?: string) {
    try {
      await apiPost('/api/ai?op=dismiss', { actionId: id, insightId });
      toast.success('Dismissed');
      await load();
    } catch (e: any) { toast.error('Dismiss failed: ' + e.message); }
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" />
            Today's Business Actions
          </h1>
          <p className="text-sm text-muted-foreground">
            AI-analysed, evidence-backed. Sensitive actions always require your approval.
          </p>
        </div>
        <Button onClick={regenerate} disabled={generating} size="sm">
          {generating ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1.5" />}
          Regenerate AI insights
        </Button>
      </div>

      {/* Summary cards */}
      {loading || !snapshot ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[1,2,3,4,5,6].map((i) => <Skeleton key={i} className="h-24" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <SummaryCard
            tone={snapshot.leadsNeedingFollowup > 0 ? 'red' : 'green'}
            icon={Phone}
            label="Leads need follow-up"
            value={snapshot.leadsNeedingFollowup}
            sub={`${snapshot.leadsTotal} total leads`}
          />
          <SummaryCard
            tone={snapshot.quotationsAmountWaiting > 0 ? 'orange' : 'green'}
            icon={FileText}
            label="Quotations waiting"
            value={`₹${formatINR(paiseToINR(snapshot.quotationsAmountWaiting))}`}
            sub={`${snapshot.quotationsStaleCount} stale (>3d)`}
          />
          <SummaryCard
            tone={snapshot.paymentsOverdueCount > 0 ? 'amber' : 'green'}
            icon={Wallet}
            label="Payments overdue"
            value={snapshot.paymentsOverdueCount}
            sub={`₹${formatINR(paiseToINR(snapshot.paymentsOverdueAmount))}`}
          />
          <SummaryCard
            tone={snapshot.tasksOverdue > 0 ? 'amber' : 'green'}
            icon={CheckSquare}
            label="Overdue tasks"
            value={snapshot.tasksOverdue}
            sub={`${snapshot.tasksOpen} open`}
          />
          <SummaryCard
            tone={snapshot.lowStockCount > 0 ? 'blue' : 'green'}
            icon={Boxes}
            label="Low stock items"
            value={snapshot.lowStockCount}
            sub="below reorder level"
          />
          <SummaryCard
            tone={snapshot.staffActivitiesPending > 0 ? 'violet' : 'green'}
            icon={Users}
            label="Staff activities"
            value={snapshot.staffActivitiesPending}
            sub="need attention"
          />
        </div>
      )}

      {/* Two-column layout: actions + insights */}
      <div className="grid lg:grid-cols-2 gap-4">
        {/* Actions */}
        <div className="space-y-3">
          <h2 className="text-base font-semibold flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" /> AI Actions
            <Badge variant="secondary" className="text-[10px]">{actions.length}</Badge>
          </h2>
          {loading ? (
            <Skeleton className="h-64" />
          ) : actions.length === 0 ? (
            <Card><CardContent className="p-8 text-center text-muted-foreground">
              <Check className="h-8 w-8 mx-auto mb-2 text-primary" />
              <p className="text-sm font-medium">No pending actions</p>
              <p className="text-xs mt-1">Either you're all caught up, or AI hasn't generated actions yet.</p>
            </CardContent></Card>
          ) : (
            actions.map((a) => (
              <ActionCard
                key={a.id}
                action={a}
                onApprove={() => approveAction(a.id)}
                onReject={() => rejectAction(a.id)}
                onExecute={() => executeAction(a.id)}
                onDismiss={() => dismissAction(a.id)}
              />
            ))
          )}
        </div>

        {/* Insights */}
        <div className="space-y-3">
          <h2 className="text-base font-semibold flex items-center gap-2">
            <Brain className="h-4 w-4 text-primary" /> AI Insights
            <Badge variant="secondary" className="text-[10px]">{insights.length}</Badge>
          </h2>
          {loading ? (
            <Skeleton className="h-64" />
          ) : insights.length === 0 ? (
            <Card><CardContent className="p-8 text-center text-muted-foreground">
              <Brain className="h-8 w-8 mx-auto mb-2 text-primary" />
              <p className="text-sm font-medium">No active insights</p>
              <p className="text-xs mt-1">Click "Regenerate AI insights" to scan your business data.</p>
            </CardContent></Card>
          ) : (
            insights.map((ins) => (
              <InsightCard key={ins.id} insight={ins} onDismiss={() => dismissAction(undefined, ins.id)} />
            ))
          )}
        </div>
      </div>

      {/* Trend */}
      {snapshot && snapshot.paymentsTotalLastMonth > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <TrendingUp className={`h-5 w-5 ${snapshot.paymentsTotalThisMonth >= snapshot.paymentsTotalLastMonth ? 'text-green-600' : 'text-red-600'}`} />
              <div>
                <p className="text-sm font-medium">Revenue this month vs last</p>
                <p className="text-xs text-muted-foreground">
                  ₹{formatINR(paiseToINR(snapshot.paymentsTotalThisMonth))} this month · ₹{formatINR(paiseToINR(snapshot.paymentsTotalLastMonth))} last month
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  sub,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  sub?: string;
  tone: 'red' | 'orange' | 'amber' | 'green' | 'blue' | 'violet';
}) {
  const tones: Record<string, string> = {
    red: 'bg-red-50 border-red-200 text-red-900',
    orange: 'bg-orange-50 border-orange-200 text-orange-900',
    amber: 'bg-amber-50 border-amber-200 text-amber-900',
    green: 'bg-green-50 border-green-200 text-green-900',
    blue: 'bg-blue-50 border-blue-200 text-blue-900',
    violet: 'bg-violet-50 border-violet-200 text-violet-900',
  };
  const iconTones: Record<string, string> = {
    red: 'text-red-600',
    orange: 'text-orange-600',
    amber: 'text-amber-600',
    green: 'text-green-600',
    blue: 'text-blue-600',
    violet: 'text-violet-600',
  };
  return (
    <Card className={`${tones[tone]}`}>
      <CardContent className="p-3">
        <div className="flex items-center gap-1.5 mb-1">
          <Icon className={`h-3.5 w-3.5 ${iconTones[tone]}`} />
          <span className="text-[10px] uppercase tracking-wider font-medium">{label}</span>
        </div>
        <div className="text-2xl font-bold leading-tight">{value}</div>
        {sub && <div className="text-[10px] opacity-80 mt-0.5">{sub}</div>}
      </CardContent>
    </Card>
  );
}

function ActionCard({
  action,
  onApprove,
  onReject,
  onExecute,
  onDismiss,
}: {
  action: ActionItem;
  onApprove: () => void;
  onReject: () => void;
  onExecute: () => void;
  onDismiss: () => void;
}) {
  const priorityTone: Record<string, string> = {
    urgent: 'bg-red-100 text-red-900 border-red-300',
    high: 'bg-orange-100 text-orange-900 border-orange-300',
    medium: 'bg-amber-100 text-amber-900 border-amber-300',
    low: 'bg-muted text-foreground border-border',
  };
  const catIcon: Record<string, any> = {
    follow_up: Phone,
    collection: Wallet,
    restock: Boxes,
    reengage: Users,
    notify: AlertTriangle,
    custom: Sparkles,
  };
  const Icon = catIcon[action.category] || Sparkles;

  return (
    <Card className={`border-l-4 ${priorityTone[action.priority] || priorityTone.medium}`}>
      <CardContent className="p-3 space-y-2">
        <div className="flex items-start gap-2">
          <Icon className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm leading-snug">{action.title}</p>
            {action.description && <p className="text-xs text-muted-foreground mt-0.5">{action.description}</p>}
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap text-[10px]">
          <Badge variant="outline" className="text-[10px]">{action.category}</Badge>
          <Badge variant="outline" className="text-[10px] capitalize">{action.priority}</Badge>
          {action.requiresApproval && <Badge variant="outline" className="text-[10px] bg-amber-50">needs approval</Badge>}
          <Badge variant="outline" className="text-[10px] capitalize">{action.riskLevel} risk</Badge>
          <span className="text-muted-foreground ml-auto">{timeAgo(action.createdAt)}</span>
        </div>
        <div className="flex gap-1 pt-1 border-t">
          {action.status === 'pending' && action.requiresApproval && (
            <>
              <Button size="sm" variant="default" className="h-7 text-xs flex-1" onClick={onApprove}>
                <Check className="h-3 w-3 mr-1" /> Approve
              </Button>
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={onReject}>
                <X className="h-3 w-3" />
              </Button>
            </>
          )}
          {action.status === 'pending' && !action.requiresApproval && (
            <Button size="sm" variant="default" className="h-7 text-xs flex-1" onClick={onExecute}>
              <Play className="h-3 w-3 mr-1" /> Execute
            </Button>
          )}
          {action.status === 'approved' && (
            <Button size="sm" variant="default" className="h-7 text-xs flex-1" onClick={onExecute}>
              <Play className="h-3 w-3 mr-1" /> Execute now
            </Button>
          )}
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={onDismiss}>
            Dismiss
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function InsightCard({ insight, onDismiss }: { insight: InsightItem; onDismiss: () => void }) {
  const typeIcon: Record<string, any> = {
    risk: AlertTriangle,
    opportunity: TrendingUp,
    anomaly: AlertTriangle,
    trend: TrendingUp,
    recommendation: Sparkles,
  };
  const Icon = typeIcon[insight.type] || Brain;
  const tone: Record<string, string> = {
    risk: 'border-red-300 bg-red-50/50',
    opportunity: 'border-green-300 bg-green-50/50',
    anomaly: 'border-amber-300 bg-amber-50/50',
    trend: 'border-blue-300 bg-blue-50/50',
    recommendation: 'border-violet-300 bg-violet-50/50',
  };
  let evidence: string[] = [];
  try { evidence = JSON.parse(insight.evidence || '[]'); } catch {}
  return (
    <Card className={`${tone[insight.type] || ''} border-l-4`}>
      <CardContent className="p-3 space-y-2">
        <div className="flex items-start gap-2">
          <Icon className="h-4 w-4 mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm leading-snug">{insight.title}</p>
            <div className="flex items-center gap-1.5 text-[10px] mt-1">
              <Badge variant="outline" className="text-[10px]">{insight.category}</Badge>
              <Badge variant="outline" className="text-[10px] capitalize">{insight.priority}</Badge>
              <span className="text-muted-foreground">confidence {insight.confidence}%</span>
            </div>
          </div>
        </div>
        {evidence.length > 0 && (
          <ul className="text-xs text-muted-foreground space-y-0.5 ml-4 list-disc">
            {evidence.slice(0, 3).map((e, i) => <li key={i}>{e}</li>)}
          </ul>
        )}
        {insight.recommendedAction && (
          <p className="text-xs">
            <span className="font-medium">Recommended: </span>
            {insight.recommendedAction}
          </p>
        )}
        {insight.uncertainty && (
          <p className="text-[10px] text-muted-foreground italic">Uncertainty: {insight.uncertainty}</p>
        )}
        <div className="flex justify-end pt-1 border-t">
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={onDismiss}>Dismiss</Button>
        </div>
      </CardContent>
    </Card>
  );
}
