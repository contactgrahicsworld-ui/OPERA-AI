'use client';

import { useState } from 'react';
import { apiGet } from '@/lib/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Sparkles, ArrowRight, Lightbulb } from 'lucide-react';
import { toast } from 'sonner';

interface Recommendation {
  what: string;
  why: string;
  evidence: string[];
  expectedImpact: string;
  nextAction: string;
  priority: number;
}

export function WhatShouldIDo() {
  const [loading, setLoading] = useState(false);
  const [recs, setRecs] = useState<Recommendation[]>([]);

  async function generate() {
    setLoading(true);
    try {
      const data = await apiGet<{ recommendations: Recommendation[] }>('/api/ai/what-should-i-do');
      setRecs(data.recommendations || []);
    } catch (e: any) {
      toast.error('Failed: ' + e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" />
            What should I do now?
          </h1>
          <p className="text-sm text-muted-foreground">
            AI analyses your business state and produces an evidence-backed prioritised action list.
          </p>
        </div>
        <Button onClick={generate} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1.5" />}
          {loading ? 'Analysing…' : 'Generate action list'}
        </Button>
      </div>

      {recs.length === 0 && !loading ? (
        <Card>
          <CardContent className="p-10 text-center text-muted-foreground">
            <Lightbulb className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm">Click "Generate action list" to get AI-suggested next steps.</p>
            <p className="text-xs mt-1">Each recommendation includes WHAT, WHY, EVIDENCE, EXPECTED IMPACT, and NEXT ACTION.</p>
          </CardContent>
        </Card>
      ) : loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}><CardContent className="p-4 space-y-2">
              <div className="h-4 w-1/3 bg-muted animate-pulse rounded" />
              <div className="h-3 w-2/3 bg-muted animate-pulse rounded" />
              <div className="h-3 w-1/2 bg-muted animate-pulse rounded" />
            </CardContent></Card>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {recs.map((r, i) => (
            <Card key={i} className="border-l-4 border-l-primary">
              <CardContent className="p-4 space-y-2">
                <div className="flex items-start gap-3">
                  <div className="h-7 w-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-semibold shrink-0">
                    {r.priority < 99 ? r.priority : '✓'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm">{r.what}</p>
                    <p className="text-xs text-muted-foreground mt-1"><span className="font-medium">Why:</span> {r.why}</p>
                    {r.evidence.length > 0 && (
                      <ul className="text-xs text-muted-foreground mt-1.5 ml-3 list-disc space-y-0.5">
                        {r.evidence.map((e, j) => <li key={j}>{e}</li>)}
                      </ul>
                    )}
                    <div className="flex items-center gap-2 mt-2 text-xs">
                      <Badge variant="secondary" className="text-[10px]">Expected: {r.expectedImpact}</Badge>
                    </div>
                    <div className="flex items-center gap-1.5 mt-2 text-xs text-primary">
                      <ArrowRight className="h-3 w-3" />
                      <span>{r.nextAction}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
