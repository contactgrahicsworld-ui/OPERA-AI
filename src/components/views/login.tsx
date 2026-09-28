'use client';

import { useState } from 'react';
import { useNav } from '@/lib/nav';
import { apiPost, apiGet } from '@/lib/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ArrowLeft, Loader2, ShieldCheck, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

export function LoginView() {
  const { setView } = useNav();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await apiPost<{ ok: boolean; isSuperAdmin?: boolean; error?: string }>('/api/auth?action=login', { email, password });
      if (!res.ok) throw new Error(res.error || 'login_failed');
      toast.success('Welcome back!');
      // Force a reload so session is checked fresh
      setTimeout(() => window.location.reload(), 500);
    } catch (e: any) {
      setError(e.message === 'invalid_credentials' ? 'Wrong email or password.' : e.message);
    } finally {
      setBusy(false);
    }
  }

  async function demoLogin() {
    setEmail('superadmin@opera.ai');
    setPassword('superadmin123');
    setTimeout(() => submit(), 100);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/20 p-4">
      <div className="w-full max-w-md">
        <button
          onClick={() => setView('landing')}
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-1.5" /> Back to home
        </button>
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2 mb-2">
              <div className="h-9 w-9 rounded-lg bg-primary text-primary-foreground flex items-center justify-center font-bold">O</div>
              <div className="font-semibold text-lg">OPERA AI</div>
            </div>
            <CardTitle>Sign in</CardTitle>
            <CardDescription>Enter your OPERA AI account credentials.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-3">
              <div>
                <Label htmlFor="email" className="text-xs">Email</Label>
                <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@business.com" />
              </div>
              <div>
                <Label htmlFor="password" className="text-xs">Password</Label>
                <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
              </div>
              {error && (
                <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/5 rounded-md p-2.5">
                  <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}
              <Button type="submit" disabled={busy} className="w-full">
                {busy ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : null}
                Sign in
              </Button>
            </form>
            <div className="mt-4 pt-4 border-t text-xs text-muted-foreground">
              <p>Don't have an account?</p>
              <button onClick={() => setView('signup')} className="text-primary hover:underline font-medium mt-1">
                Start your 7-day free trial →
              </button>
            </div>
          </CardContent>
        </Card>

        <div className="mt-4 text-center">
          <button onClick={demoLogin} className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5" /> Try Super Admin demo
          </button>
        </div>
      </div>
    </div>
  );
}
