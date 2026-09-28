'use client';

import { useState } from 'react';
import { useNav } from '@/lib/nav';
import { apiPost } from '@/lib/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ArrowLeft, Loader2, AlertCircle, Crown, ShieldCheck, Lock } from 'lucide-react';
import { toast } from 'sonner';

export function FirstAdminSetupView() {
  const { setView } = useNav();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [setupKey, setSetupKey] = useState('');

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const res = await apiPost<{ ok: boolean; error?: string; message?: string }>('/api/setup-first-admin', {
        name,
        email,
        whatsappNumber,
        password,
        confirmPassword,
        setupKey,
      });
      if (!res.ok) throw new Error(res.error || 'setup_failed');
      toast.success('First Super Admin created. Setup is now LOCKED.');
      // Auto-login: switch to login view
      setTimeout(() => {
        setView('login');
      }, 1500);
    } catch (e: any) {
      const msg = e.message;
      if (msg === 'email_taken') setError('This email is already registered.');
      else if (msg === 'invalid_setup_key') setError('Invalid setup key. The deployer controls this key — check your env vars.');
      else if (msg === 'setup_locked') setError('Setup is already LOCKED. A first Super Admin has already been created.');
      else if (msg === 'password_mismatch') setError('Passwords do not match.');
      else setError(msg);
    } finally {
      setBusy(false);
    }
  }

  const valid = name.length >= 2 && /\S+@\S+\.\S+/.test(email) && /^[0-9]{10,15}$/.test(whatsappNumber) && password.length >= 10 && password === confirmPassword && setupKey.length >= 10;

  return (
    <div className="min-h-screen flex flex-col bg-muted/20">
      <header className="border-b border-border bg-background">
        <div className="max-w-3xl mx-auto px-4 lg:px-6 h-14 flex items-center justify-between">
          <button onClick={() => setView('landing')} className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4 mr-1.5" /> Back
          </button>
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm">O</div>
            <div className="font-semibold">OPERA AI</div>
          </div>
        </div>
      </header>

      <div className="flex-1 flex items-center py-8">
        <div className="w-full max-w-xl mx-auto px-4 lg:px-6">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2 mb-2">
                <div className="h-10 w-10 rounded-full bg-amber-100 text-amber-900 flex items-center justify-center">
                  <Crown className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle>Create first Super Admin</CardTitle>
                  <CardDescription>This is a one-time setup. After creation, this flow will be LOCKED permanently.</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {error && (
                <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/5 rounded-md p-2.5">
                  <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div>
                <Label className="text-xs">Full name *</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Platform Owner" />
              </div>
              <div>
                <Label className="text-xs">Email *</Label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="owner@opera.ai" />
              </div>
              <div>
                <Label className="text-xs">Registered WhatsApp number (10-15 digits, no +) *</Label>
                <Input value={whatsappNumber} onChange={(e) => setWhatsappNumber(e.target.value.replace(/[^0-9]/g, ''))} placeholder="9301056006" maxLength={15} />
                <p className="text-[10px] text-muted-foreground mt-1">Used for password recovery. Must be 10-15 digits.</p>
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Password (min 10 chars) *</Label>
                  <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">Confirm password *</Label>
                  <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
                </div>
              </div>
              {password.length > 0 && password.length < 10 && (
                <p className="text-[10px] text-amber-600">Password must be at least 10 characters.</p>
              )}
              {password && confirmPassword && password !== confirmPassword && (
                <p className="text-[10px] text-destructive">Passwords do not match.</p>
              )}
              <div>
                <Label className="text-xs">First-admin setup key *</Label>
                <Input type="password" value={setupKey} onChange={(e) => setSetupKey(e.target.value)} placeholder="opera-ai-..." />
                <p className="text-[10px] text-muted-foreground mt-1">Provided by the platform deployer. Set as <code>FIRST_ADMIN_SETUP_KEY</code> env var on Vercel.</p>
              </div>

              <div className="bg-muted/50 rounded-md p-3 text-xs text-muted-foreground flex items-start gap-2">
                <ShieldCheck className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
                <div>
                  <p className="font-medium text-foreground mb-1">Security guarantees:</p>
                  <ul className="list-disc ml-4 space-y-0.5">
                    <li>No hardcoded super admin email/password anywhere in codebase.</li>
                    <li>Setup locks permanently after first creation.</li>
                    <li>Only an authorized super admin can create another super admin.</li>
                    <li>Password recovery uses WhatsApp OTP (rate-limited, hashed, time-limited).</li>
                  </ul>
                </div>
              </div>

              <Button onClick={submit} disabled={busy || !valid} className="w-full">
                {busy ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Creating first Super Admin…</> : <><Crown className="h-4 w-4 mr-1.5" /> Create first Super Admin + Lock setup</>}
              </Button>
              <p className="text-[10px] text-center text-muted-foreground flex items-center justify-center gap-1 pt-2">
                <Lock className="h-3 w-3" /> This flow runs only once. After creation, login at the sign-in page.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
