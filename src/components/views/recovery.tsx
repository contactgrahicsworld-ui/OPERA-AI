'use client';

import { useState } from 'react';
import { useNav } from '@/lib/nav';
import { apiPost } from '@/lib/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ArrowLeft, Loader2, AlertCircle, ShieldCheck, Check, MessageCircle } from 'lucide-react';
import { toast } from 'sonner';

type Step = 'initiate' | 'verify' | 'reset' | 'done';

export function RecoveryView() {
  const { setView } = useNav();
  const [step, setStep] = useState<Step>('initiate');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [email, setEmail] = useState('');
  const [recoveryId, setRecoveryId] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [whatsappNote, setWhatsappNote] = useState<string | null>(null);

  async function initiate() {
    setBusy(true);
    setError(null);
    try {
      const res = await apiPost<{ ok: boolean; recoveryId?: string; whatsappStatus?: string; whatsappMessage?: string; sent?: boolean; manualCodeIfUnconfigured?: string }>('/api/super-admin/recovery/initiate', { email });
      if (!res.ok || !res.recoveryId) {
        throw new Error('initiate_failed');
      }
      setRecoveryId(res.recoveryId);
      setWhatsappNote(res.whatsappMessage || 'Recovery code sent via WhatsApp.');
      if (res.whatsappStatus === 'NOT_CONFIGURED' && res.manualCodeIfUnconfigured) {
        // Dev/test fallback — show the code in the UI (NEVER happens in production with WhatsApp configured)
        setWhatsappNote(`⚠ WhatsApp provider NOT_CONFIGURED. For dev/test, your one-time code is: ${res.manualCodeIfUnconfigured}`);
      }
      setStep('verify');
      toast.success('Recovery code generated.');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function verify() {
    setBusy(true);
    setError(null);
    try {
      const res = await apiPost<{ ok: boolean; verified?: boolean; error?: string; attemptsRemaining?: number }>('/api/super-admin/recovery/verify', { recoveryId, code });
      if (!res.ok || !res.verified) {
        if (res.attemptsRemaining !== undefined) {
          setError(`Invalid code. ${res.attemptsRemaining} attempts remaining.`);
        } else {
          setError(res.error || 'invalid_code');
        }
        return;
      }
      setStep('reset');
      toast.success('Code verified. Set your new password.');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function reset() {
    setBusy(true);
    setError(null);
    try {
      const res = await apiPost<{ ok: boolean; error?: string; message?: string }>('/api/super-admin/recovery/reset-password', { recoveryId, code, newPassword, confirmPassword });
      if (!res.ok) {
        setError(res.error || 'reset_failed');
        return;
      }
      setStep('done');
      toast.success('Password reset. You can now sign in.');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

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
        <div className="w-full max-w-md mx-auto px-4 lg:px-6">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2 mb-2">
                <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle>Super Admin password recovery</CardTitle>
                  <CardDescription>Step {step === 'initiate' ? 1 : step === 'verify' ? 2 : step === 'reset' ? 3 : 4} of 3 — secure WhatsApp OTP flow.</CardDescription>
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

              {step === 'initiate' && (
                <>
                  <div>
                    <Label className="text-xs">Super Admin email</Label>
                    <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="owner@opera.ai" />
                  </div>
                  <Button onClick={initiate} disabled={busy || !email} className="w-full">
                    {busy ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : null}
                    Send WhatsApp recovery code
                  </Button>
                </>
              )}

              {step === 'verify' && (
                <>
                  {whatsappNote && (
                    <div className="text-xs bg-amber-50 border border-amber-200 text-amber-900 rounded-md p-2.5 flex items-start gap-2">
                      <MessageCircle className="h-4 w-4 mt-0.5 shrink-0" />
                      <span>{whatsappNote}</span>
                    </div>
                  )}
                  <div>
                    <Label className="text-xs">6-digit code</Label>
                    <Input value={code} onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))} placeholder="123456" inputMode="numeric" />
                    <p className="text-[10px] text-muted-foreground mt-1">Code expires in 10 minutes. Max 5 attempts.</p>
                  </div>
                  <Button onClick={verify} disabled={busy || code.length !== 6} className="w-full">
                    {busy ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : null}
                    Verify code
                  </Button>
                  <button onClick={() => setStep('initiate')} className="text-xs text-muted-foreground hover:text-foreground w-full text-center">
                    ← Use a different email
                  </button>
                </>
              )}

              {step === 'reset' && (
                <>
                  <div>
                    <Label className="text-xs">New password (min 10 chars)</Label>
                    <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs">Confirm new password</Label>
                    <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
                  </div>
                  {newPassword && newPassword.length < 10 && (
                    <p className="text-[10px] text-amber-600">Password must be at least 10 characters.</p>
                  )}
                  {newPassword && confirmPassword && newPassword !== confirmPassword && (
                    <p className="text-[10px] text-destructive">Passwords do not match.</p>
                  )}
                  <Button onClick={reset} disabled={busy || newPassword.length < 10 || newPassword !== confirmPassword} className="w-full">
                    {busy ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : null}
                    Reset password
                  </Button>
                </>
              )}

              {step === 'done' && (
                <div className="text-center py-4 space-y-3">
                  <div className="h-12 w-12 mx-auto rounded-full bg-green-100 text-green-600 flex items-center justify-center">
                    <Check className="h-6 w-6" />
                  </div>
                  <p className="font-medium">Password reset successfully.</p>
                  <p className="text-xs text-muted-foreground">You can now sign in with your new password.</p>
                  <Button onClick={() => setView('login')} className="w-full">
                    Sign in
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
