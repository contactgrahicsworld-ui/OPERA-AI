'use client';

import { useState } from 'react';
import { useNav } from '@/lib/nav';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Loader2, Sparkles, Brain, LayoutDashboard as ActionIcon, Workflow, Shield, Smartphone, Globe, AlertTriangle, Crown } from 'lucide-react';
import { toast } from 'sonner';

export function LandingView({ setupRequired = false }: { setupRequired?: boolean }) {
  const { setView } = useNav();

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Top nav */}
      <header className="border-b border-border bg-background/95 backdrop-blur supports-[backfilter]:bg-background/60 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 lg:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center font-bold">O</div>
            <div className="font-semibold text-lg">OPERA AI</div>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => setView('login')}>Sign in</Button>
            <Button size="sm" onClick={() => setView('signup')}>Start free</Button>
          </div>
        </div>
      </header>

      {/* First-admin setup warning banner */}
      {setupRequired && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-3">
          <div className="max-w-7xl mx-auto flex items-center gap-3 flex-wrap">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">First-time platform setup required.</p>
              <p className="text-xs text-amber-800/80">No Super Admin exists yet. Create the first Super Admin to take control of the platform.</p>
            </div>
            <Button size="sm" variant="default" onClick={() => setView('first_admin_setup')}>
              <Crown className="h-4 w-4 mr-1.5" /> Create first Super Admin
            </Button>
          </div>
        </div>
      )}

      {/* Hero */}
      <section className="flex-1 flex items-center bg-gradient-to-br from-primary/10 via-background to-background">
        <div className="max-w-7xl mx-auto px-4 lg:px-6 py-16 grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs bg-primary/10 text-primary rounded-full px-3 py-1 mb-5">
              <Sparkles className="h-3.5 w-3.5" /> AI Business Operator
            </div>
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-4 leading-tight">
              Aap business chalaiye.<br />
              <span className="text-primary">AI business kaam sambhalega.</span>
            </h1>
            <p className="text-muted-foreground text-lg mb-6 max-w-xl">
              OPERA AI samajhta hai aapka business, prioritize karta hai important kaam,
              aur approved actions execute karta hai — kisi bhi industry ke liye.
            </p>
            <div className="flex gap-3 flex-wrap">
              <Button size="lg" onClick={() => setView('signup')}>
                Start 7-day free trial
              </Button>
              <Button variant="outline" size="lg" onClick={() => setView('login')}>
                I already have an account
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              No credit card required. Industry-agnostic. Works for any business.
            </p>
          </div>

          {/* Mock Action Center preview */}
          <Card className="shadow-xl border-primary/20">
            <CardHeader className="border-b bg-muted/30">
              <CardTitle className="flex items-center gap-2 text-base">
                <ActionIcon className="h-4 w-4 text-primary" />
                Today's Business Actions
              </CardTitle>
              <CardDescription className="text-xs">
                AI-suggested, evidence-backed. You approve, AI executes.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-3 space-y-2">
              <ActionCard color="red" text="8 leads need follow-up" />
              <ActionCard color="orange" text="₹2,40,000 quotations are waiting" />
              <ActionCard color="amber" text="5 customer payments are overdue" />
              <ActionCard color="amber" text="3 tasks are overdue" />
              <ActionCard color="blue" text="7 products are below stock threshold" />
              <ActionCard color="violet" text="2 staff activities need attention" />
            </CardContent>
            <CardFooter className="border-t bg-muted/30 py-2 text-xs text-muted-foreground justify-between">
              <span>Each item supports: View • Approve • Execute • Dismiss</span>
              <Sparkles className="h-3.5 w-3.5 text-primary" />
            </CardFooter>
          </Card>
        </div>
      </section>

      {/* Core principles */}
      <section className="border-t border-border bg-muted/20">
        <div className="max-w-7xl mx-auto px-4 lg:px-6 py-14">
          <h2 className="text-2xl font-semibold mb-2 text-center">Built different. Built to operate.</h2>
          <p className="text-muted-foreground text-center mb-10 max-w-2xl mx-auto">
            OPERA AI is NOT a CRM with AI sprinkled on top. It's an AI Business Operator —
            the central nervous system for your business.
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Feature icon={Brain} title="AI Business Brain" text="Understands your business DNA, identifies important situations, recommends evidence-backed actions." />
            <Feature icon={ActionIcon} title="Action Center is primary" text="Not charts. Action Center shows what needs your attention right now — colour-coded by urgency." />
            <Feature icon={Sparkles} title="What should I do now?" text="Click and AI produces a prioritised, evidence-backed action list with WHY and expected impact." />
            <Feature icon={Workflow} title="Universal workflow engine" text="Trigger → Conditions → Actions → Approval → Execution → Result → Audit. No hardcoding." />
            <Feature icon={Shield} title="Multi-tenant + RBAC" text="Strict tenant isolation. Server-side authorization. Sensitive actions ALWAYS require human approval." />
            <Feature icon={Globe} title="Industry-agnostic" text="Adapts to ANY business through onboarding + Business DNA. Not a Solar / Real Estate / Coaching tool." />
          </div>
        </div>
      </section>

      {/* Super admin login link */}
      <section className="border-t border-border">
        <div className="max-w-7xl mx-auto px-4 lg:px-6 py-6 text-center text-xs text-muted-foreground flex items-center justify-center gap-2 flex-wrap">
          <Shield className="h-3.5 w-3.5" />
          <span>Platform operator?</span>
          <button onClick={() => setView('login')} className="text-primary hover:underline">Sign in as Super Admin</button>
          <span>·</span>
          <Smartphone className="h-3.5 w-3.5" />
          <span>Installable as PWA · Works on mobile</span>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-background">
        <div className="max-w-7xl mx-auto px-4 lg:px-6 py-6 text-xs text-muted-foreground flex flex-wrap items-center justify-between gap-2">
          <div>© {new Date().getFullYear()} OPERA AI · AI Business Operator</div>
          <div className="flex gap-3">
            <span>v2.0.0</span>
            <span>·</span>
            <span>Production SaaS</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

function ActionCard({ color, text }: { color: string; text: string }) {
  const colors: Record<string, string> = {
    red: 'bg-red-50 border-red-200 text-red-900',
    orange: 'bg-orange-50 border-orange-200 text-orange-900',
    amber: 'bg-amber-50 border-amber-200 text-amber-900',
    blue: 'bg-blue-50 border-blue-200 text-blue-900',
    violet: 'bg-violet-50 border-violet-200 text-violet-900',
  };
  const dots: Record<string, string> = {
    red: 'bg-red-500',
    orange: 'bg-orange-500',
    amber: 'bg-amber-500',
    blue: 'bg-blue-500',
    violet: 'bg-violet-500',
  };
  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-md border text-sm ${colors[color]}`}>
      <div className={`h-2 w-2 rounded-full ${dots[color]}`} />
      {text}
    </div>
  );
}

function Feature({ icon: Icon, title, text }: { icon: any; title: string; text: string }) {
  return (
    <Card className="border-border/60">
      <CardContent className="p-5">
        <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-3">
          <Icon className="h-5 w-5" />
        </div>
        <h3 className="font-semibold mb-1.5">{title}</h3>
        <p className="text-sm text-muted-foreground leading-relaxed">{text}</p>
      </CardContent>
    </Card>
  );
}
