'use client';

import { useState } from 'react';
import { apiPost } from '@/lib/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Loader2, Brain, Send, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

const SUGGESTED_QUESTIONS = [
  'Why are my sales falling?',
  'Which leads need attention?',
  'Which quotations are stuck?',
  'Which customers have become inactive?',
  'What should I focus on today?',
  'Which products are selling slowly?',
  'Where is money getting stuck?',
  'Which tasks are overdue?',
  'What changed this month?',
  'Compare this month with last month.',
];

interface AnswerSection {
  type: 'FACT' | 'CALCULATION' | 'INFERENCE' | 'RECOMMENDATION';
  text: string;
  evidence: string[];
}

export function Advisor() {
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [answer, setAnswer] = useState<string | null>(null);
  const [sections, setSections] = useState<AnswerSection[]>([]);
  const [insufficientData, setInsufficientData] = useState(false);

  async function ask(q?: string) {
    const questionText = (q ?? question).trim();
    if (!questionText) return;
    setQuestion(questionText);
    setLoading(true);
    setAnswer(null);
    setSections([]);
    setInsufficientData(false);
    try {
      const res = await apiPost<{ answer: string; sections: AnswerSection[]; insufficientData: boolean }>('/api/ai/advisor', { question: questionText });
      setAnswer(res.answer);
      setSections(res.sections || []);
      setInsufficientData(!!res.insufficientData);
    } catch (e: any) {
      toast.error('Advisor failed: ' + e.message);
    } finally {
      setLoading(false);
    }
  }

  const sectionTone: Record<string, string> = {
    FACT: 'bg-blue-50 text-blue-900 border-blue-200',
    CALCULATION: 'bg-amber-50 text-amber-900 border-amber-200',
    INFERENCE: 'bg-violet-50 text-violet-900 border-violet-200',
    RECOMMENDATION: 'bg-green-50 text-green-900 border-green-200',
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <Brain className="h-6 w-6 text-primary" />
          AI Business Advisor
        </h1>
        <p className="text-sm text-muted-foreground">
          Ask any question about your business. Answers are grounded in real tenant data — never invented.
        </p>
      </div>

      <Card>
        <CardContent className="p-4 space-y-3">
          <Textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask anything about your business…"
            rows={3}
            className="resize-none"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) ask();
            }}
          />
          <div className="flex justify-end gap-2">
            <Button onClick={() => ask()} disabled={loading || !question.trim()}>
              {loading ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Send className="h-4 w-4 mr-1.5" />}
              {loading ? 'Thinking…' : 'Ask'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Suggested questions */}
      <div>
        <p className="text-xs text-muted-foreground mb-2">Try one of these:</p>
        <div className="flex flex-wrap gap-1.5">
          {SUGGESTED_QUESTIONS.map((q) => (
            <button
              key={q}
              onClick={() => ask(q)}
              disabled={loading}
              className="text-xs px-2.5 py-1 rounded-full border bg-background hover:bg-muted transition-colors disabled:opacity-50"
            >
              {q}
            </button>
          ))}
        </div>
      </div>

      {/* Answer */}
      {answer !== null && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Brain className="h-4 w-4 text-primary" /> AI Advisor
            </CardTitle>
            <CardDescription className="text-xs">
              Sections are tagged by type. AI is not allowed to invent facts.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {insufficientData && (
              <div className="flex items-start gap-2 text-sm bg-amber-50 text-amber-900 border border-amber-200 rounded-md p-3">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                <span>Insufficient data to determine this. Add more records or refine your question.</span>
              </div>
            )}
            <p className="text-sm font-medium leading-relaxed">{answer}</p>
            {sections.length > 0 && (
              <div className="space-y-2 pt-2 border-t">
                {sections.map((s, i) => (
                  <div key={i} className={`rounded-md border p-2.5 ${sectionTone[s.type] || 'bg-muted'}`}>
                    <Badge variant="outline" className="text-[10px] mb-1.5 bg-background">{s.type}</Badge>
                    <p className="text-sm leading-relaxed">{s.text}</p>
                    {s.evidence.length > 0 && (
                      <ul className="text-xs opacity-80 mt-1.5 list-disc ml-4 space-y-0.5">
                        {s.evidence.map((e, j) => <li key={j}>{e}</li>)}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
