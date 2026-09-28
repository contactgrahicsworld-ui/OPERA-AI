'use client';

import { useState } from 'react';
import { useNav } from '@/lib/nav';
import { apiPost } from '@/lib/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Loader2, AlertCircle, Building2, Check } from 'lucide-react';
import { toast } from 'sonner';

const INDUSTRIES = [
  'Retail', 'Manufacturing', 'Restaurant', 'Real Estate', 'Solar',
  'Insurance', 'Coaching', 'IT Services', 'Consulting', 'Logistics',
  'Healthcare', 'Education', 'E-commerce', 'Construction', 'Hospitality',
  'Financial Services', 'Marketing Agency', 'Other',
];

const BUSINESS_TYPES = [
  'B2B Service', 'B2C Service', 'B2B Product', 'B2C Product', 'Marketplace',
  'Subscription', 'SaaS', 'Agency', 'Distributor', 'Manufacturer',
  'Consultancy', 'Retail Store', 'Other',
];

export function SignupView() {
  const { setView } = useNav();
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Account
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  // Business
  const [businessName, setBusinessName] = useState('');
  const [businessType, setBusinessType] = useState('');
  const [industry, setIndustry] = useState('');
  const [currency, setCurrency] = useState('INR');
  const [usesInventory, setUsesInventory] = useState(false);
  // Optional details
  const [products, setProducts] = useState('');
  const [services, setServices] = useState('');
  const [customerTypes, setCustomerTypes] = useState('');
  const [salesProcess, setSalesProcess] = useState('');
  const [departments, setDepartments] = useState('');
  const [paymentProcess, setPaymentProcess] = useState('');
  const [followUpProcess, setFollowUpProcess] = useState('');
  const [customWorkflow, setCustomWorkflow] = useState('');

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const res = await apiPost<{ ok: boolean; error?: string }>('/api/auth?action=signup', {
        email, password, name,
        businessName, businessType, industry, currency, usesInventory,
        products, services, customerTypes, salesProcess,
        departments, paymentProcess, followUpProcess, customWorkflow,
      });
      if (!res.ok) throw new Error('signup_failed');
      toast.success('Welcome to OPERA AI! Generating your Business DNA…');
      setTimeout(() => window.location.reload(), 1500);
    } catch (e: any) {
      if (e.message === 'email_taken') setError('This email is already registered. Try signing in.');
      else if (e.message === 'invalid_input') setError('Please check your inputs — minimum 6-character password and valid email.');
      else setError(e.message);
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
        <div className="w-full max-w-2xl mx-auto px-4 lg:px-6">
          {/* Progress */}
          <div className="flex items-center gap-2 mb-6">
            <Step num={1} label="Account" active={step >= 1} done={step > 1} />
            <div className="flex-1 h-px bg-border" />
            <Step num={2} label="Business" active={step >= 2} done={step > 2} />
            <div className="flex-1 h-px bg-border" />
            <Step num={3} label="Details" active={step >= 3} done={false} />
          </div>

          {error && (
            <div className="mb-4 flex items-start gap-2 text-sm text-destructive bg-destructive/5 rounded-md p-2.5">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {step === 1 && (
            <Card>
              <CardHeader>
                <CardTitle>Create your account</CardTitle>
                <CardDescription>Start your 7-day free trial. No credit card required.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label className="text-xs">Your name</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Aarav Sharma" required />
                </div>
                <div>
                  <Label className="text-xs">Email</Label>
                  <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@business.com" required />
                </div>
                <div>
                  <Label className="text-xs">Password</Label>
                  <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="min 6 characters" required />
                </div>
                <Button onClick={() => setStep(2)} disabled={!name || !email || password.length < 6} className="w-full">
                  Continue
                </Button>
              </CardContent>
            </Card>
          )}

          {step === 2 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Building2 className="h-5 w-5 text-primary" />Tell us about your business</CardTitle>
                <CardDescription>OPERA AI will adapt to ANY industry. Tell us the basics.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label className="text-xs">Business name *</Label>
                  <Input value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="Acme Pvt Ltd" required />
                </div>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Business type</Label>
                    <Select value={businessType} onValueChange={setBusinessType}>
                      <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                      <SelectContent>
                        {BUSINESS_TYPES.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Industry</Label>
                    <Select value={industry} onValueChange={setIndustry}>
                      <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                      <SelectContent>
                        {INDUSTRIES.map((i) => <SelectItem key={i} value={i}>{i}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Currency</Label>
                    <Select value={currency} onValueChange={setCurrency}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="INR">INR (₹)</SelectItem>
                        <SelectItem value="USD">USD ($)</SelectItem>
                        <SelectItem value="EUR">EUR (€)</SelectItem>
                        <SelectItem value="GBP">GBP (£)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Inventory usage</Label>
                    <Select value={usesInventory ? 'yes' : 'no'} onValueChange={(v) => setUsesInventory(v === 'yes')}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="no">No inventory (service only)</SelectItem>
                        <SelectItem value="yes">Yes, we hold stock</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setStep(1)} className="flex-1">Back</Button>
                  <Button onClick={() => setStep(3)} disabled={!businessName} className="flex-1">Continue</Button>
                </div>
              </CardContent>
            </Card>
          )}

          {step === 3 && (
            <Card>
              <CardHeader>
                <CardTitle>Optional: business details</CardTitle>
                <CardDescription>The more you share, the smarter the AI Business DNA.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label className="text-xs">Products (comma separated)</Label>
                  <Input value={products} onChange={(e) => setProducts(e.target.value)} placeholder="e.g. Widget A, Widget B" />
                </div>
                <div>
                  <Label className="text-xs">Services (comma separated)</Label>
                  <Input value={services} onChange={(e) => setServices(e.target.value)} placeholder="e.g. Installation, Maintenance, Consulting" />
                </div>
                <div>
                  <Label className="text-xs">Customer types</Label>
                  <Input value={customerTypes} onChange={(e) => setCustomerTypes(e.target.value)} placeholder="e.g. B2B, B2C, Enterprise, SMB" />
                </div>
                <div>
                  <Label className="text-xs">Sales process</Label>
                  <Input value={salesProcess} onChange={(e) => setSalesProcess(e.target.value)} placeholder="e.g. Lead → Demo → Quote → Close" />
                </div>
                <div>
                  <Label className="text-xs">Departments</Label>
                  <Input value={departments} onChange={(e) => setDepartments(e.target.value)} placeholder="e.g. Sales, Operations, Finance" />
                </div>
                <div>
                  <Label className="text-xs">Payment process</Label>
                  <Textarea value={paymentProcess} onChange={(e) => setPaymentProcess(e.target.value)} rows={2} placeholder="How do customers pay you?" />
                </div>
                <div>
                  <Label className="text-xs">Follow-up process</Label>
                  <Textarea value={followUpProcess} onChange={(e) => setFollowUpProcess(e.target.value)} rows={2} placeholder="How do you follow up with leads/customers?" />
                </div>
                <div>
                  <Label className="text-xs">Custom workflow requirements</Label>
                  <Textarea value={customWorkflow} onChange={(e) => setCustomWorkflow(e.target.value)} rows={3} placeholder="Anything specific you'd like OPERA AI to automate?" />
                </div>
                <div className="flex gap-2 pt-2">
                  <Button variant="outline" onClick={() => setStep(2)} className="flex-1">Back</Button>
                  <Button onClick={submit} disabled={busy || !businessName || !email || password.length < 6 || !name} className="flex-1">
                    {busy ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Creating…</> : 'Create account & generate DNA'}
                  </Button>
                </div>
                <p className="text-[10px] text-muted-foreground text-center pt-1">
                  We'll generate your Business DNA, install default workflows, and set up your Action Center.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function Step({ num, label, active, done }: { num: number; label: string; active: boolean; done: boolean }) {
  if (done) {
    return (
      <div className="flex items-center gap-1.5 text-primary">
        <div className="h-6 w-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs">
          <Check className="h-3 w-3" />
        </div>
        <span className="text-xs font-medium hidden sm:inline">{label}</span>
      </div>
    );
  }
  return (
    <div className={`flex items-center gap-1.5 ${active ? 'text-primary' : 'text-muted-foreground'}`}>
      <div className={`h-6 w-6 rounded-full ${active ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'} flex items-center justify-center text-xs font-semibold`}>
        {num}
      </div>
      <span className={`text-xs ${active ? 'font-medium' : ''} hidden sm:inline`}>{label}</span>
    </div>
  );
}
