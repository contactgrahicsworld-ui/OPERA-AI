'use client';

import { useState } from 'react';
import { apiPost } from '@/lib/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Bot, Send, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

interface Response {
  ok: boolean;
  intent: string;
  response: string;
  action: string;
  actionResult: any;
  aiEnhanced: boolean;
  businessContext: { name: string; hours: string; products: string; services: string };
}

export function AIReceptionistView() {
  const [message, setMessage] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<Response | null>(null);

  async function send() {
    if (!message.trim()) return;
    setLoading(true);
    setResponse(null);
    try {
      const res = await apiPost<Response>('/api/receptionist', {
        message,
        customerName: customerName || undefined,
        customerPhone: customerPhone || undefined,
        customerEmail: customerEmail || undefined,
        channel: 'web',
      });
      setResponse(res);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }

  const intentTone: Record<string, string> = {
    pricing: 'bg-blue-100 text-blue-900',
    business_hours: 'bg-green-100 text-green-900',
    complaint: 'bg-red-100 text-red-900',
    appointment_request: 'bg-violet-100 text-violet-900',
    sales_enquiry: 'bg-amber-100 text-amber-900',
    support_request: 'bg-orange-100 text-orange-900',
    escalation: 'bg-red-100 text-red-900',
    product_information: 'bg-teal-100 text-teal-900',
    general_info: 'bg-muted text-foreground',
  };

  const actionTone: Record<string, string> = {
    create_lead: 'bg-green-100 text-green-900',
    create_appointment: 'bg-violet-100 text-violet-900',
    create_task: 'bg-orange-100 text-orange-900',
    escalate: 'bg-red-100 text-red-900',
    none: 'bg-muted text-foreground',
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <Bot className="h-6 w-6 text-primary" /> AI Receptionist
        </h1>
        <p className="text-sm text-muted-foreground">
          Handles customer enquiries: intent detection, business info retrieval, lead/appointment/task creation, escalation to human.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Simulate a customer enquiry</CardTitle>
          <CardDescription className="text-xs">
            Test the AI receptionist by entering a customer message + optional contact info. The receptionist will detect intent, respond, and create a lead/appointment/task as needed.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid sm:grid-cols-3 gap-3">
            <div>
              <Label className="text-xs">Customer name (optional)</Label>
              <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Rahul Sharma" />
            </div>
            <div>
              <Label className="text-xs">Phone (optional)</Label>
              <Input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value.replace(/[^0-9]/g, ''))} placeholder="9876543210" />
            </div>
            <div>
              <Label className="text-xs">Email (optional)</Label>
              <Input type="email" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} placeholder="rahul@x.com" />
            </div>
          </div>
          <div>
            <Label className="text-xs">Customer message *</Label>
            <Textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3} placeholder="Hi, I want to know your pricing for the Growth plan." />
          </div>
          <Button onClick={send} disabled={loading || !message.trim()}>
            {loading ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Send className="h-4 w-4 mr-1.5" />}
            Send enquiry
          </Button>
        </CardContent>
      </Card>

      {response && (
        <Card className="border-l-4 border-l-primary">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Bot className="h-4 w-4 text-primary" /> Receptionist response
              {response.aiEnhanced && <Badge variant="secondary" className="text-[10px] bg-violet-100 text-violet-900"><Sparkles className="h-3 w-3 mr-1" /> AI-enhanced</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className={`text-[10px] ${intentTone[response.intent] || ''}`}>
                Intent: {response.intent}
              </Badge>
              <Badge variant="outline" className={`text-[10px] ${actionTone[response.action] || ''}`}>
                Action: {response.action}
              </Badge>
            </div>
            <div className="bg-muted/30 rounded-md p-3 text-sm">{response.response}</div>
            {response.actionResult && (
              <div className="text-xs bg-green-50 border border-green-200 text-green-900 rounded-md p-2.5">
                <strong>Action result:</strong> {response.actionResult.type}
                {response.actionResult.leadId && <div className="mt-1">Created lead: <code className="font-mono text-[10px]">{response.actionResult.leadId}</code></div>}
                {response.actionResult.taskId && <div className="mt-1">Created task: <code className="font-mono text-[10px]">{response.actionResult.taskId}</code></div>}
                {response.actionResult.notificationId && <div className="mt-1">Escalation notification: <code className="font-mono text-[10px]">{response.actionResult.notificationId}</code></div>}
              </div>
            )}
            <div className="text-[10px] text-muted-foreground">
              Business context used: {response.businessContext.name} | Hours: {response.businessContext.hours || 'n/a'} | Products: {response.businessContext.products || 'n/a'}
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="bg-amber-50 border-amber-200">
        <CardContent className="p-3 text-xs text-amber-900">
          <p className="font-medium mb-1">ℹ AI Receptionist architecture</p>
          <p>Intent detection is rule-based for reliability. Response can be AI-augmented when AI provider is available, otherwise uses deterministic business-data lookup. Never invents business facts. Indian-language support architecture is in place — actual multi-language reception requires a configured AI voice/text provider.</p>
        </CardContent>
      </Card>
    </div>
  );
}
