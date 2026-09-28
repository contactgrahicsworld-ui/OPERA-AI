'use client';

import { useEffect, useState } from 'react';
import { apiGet } from '@/lib/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollText } from 'lucide-react';
import { formatDateTime } from '@/lib/client';
import { toast } from 'sonner';

interface AuditLog {
  id: string;
  action: string;
  entity: string;
  entityId: string;
  details: string;
  ip: string;
  userId?: string;
  createdAt: string;
}

const ACTION_TONES: Record<string, string> = {
  create: 'bg-green-100 text-green-900',
  update: 'bg-amber-100 text-amber-900',
  delete: 'bg-red-100 text-red-900',
  approve: 'bg-blue-100 text-blue-900',
  execute: 'bg-violet-100 text-violet-900',
  login: 'bg-muted text-foreground',
  logout: 'bg-muted text-foreground',
  signup: 'bg-green-100 text-green-900',
};

export function AuditView() {
  const [items, setItems] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState('all');

  async function load() {
    setLoading(true);
    try {
      const data = await apiGet<{ items: AuditLog[] }>(`/api/audit?limit=200${actionFilter !== 'all' ? `&action=${actionFilter}` : ''}`);
      setItems(data.items || []);
    } catch (e: any) {
      toast.error('Failed: ' + e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const id = setTimeout(load, 200);
    return () => clearTimeout(id);
  }, [actionFilter]);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <ScrollText className="h-6 w-6 text-primary" /> Audit Log
          </h1>
          <p className="text-sm text-muted-foreground">Every important action — recorded for compliance and security.</p>
        </div>
        <Select value={actionFilter} onValueChange={setActionFilter}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All actions</SelectItem>
            <SelectItem value="create">Create</SelectItem>
            <SelectItem value="update">Update</SelectItem>
            <SelectItem value="delete">Delete</SelectItem>
            <SelectItem value="approve">Approve</SelectItem>
            <SelectItem value="execute">Execute</SelectItem>
            <SelectItem value="login">Login</SelectItem>
            <SelectItem value="logout">Logout</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 space-y-2">{[1,2,3,4].map((i) => <Skeleton key={i} className="h-14" />)}</div>
          ) : items.length === 0 ? (
            <div className="p-10 text-center text-muted-foreground">
              <ScrollText className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p className="text-sm">No audit entries yet.</p>
            </div>
          ) : (
            <div className="max-h-[calc(100vh-220px)] overflow-y-auto custom-scrollbar">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-muted/30 backdrop-blur">
                  <tr className="border-b">
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">When</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Action</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Entity</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Details</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">IP</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((log) => (
                    <tr key={log.id} className="border-b hover:bg-muted/30">
                      <td className="px-4 py-2.5 whitespace-nowrap text-xs text-muted-foreground">{formatDateTime(log.createdAt)}</td>
                      <td className="px-4 py-2.5">
                        <Badge variant="secondary" className={`text-[10px] ${ACTION_TONES[log.action] || ''}`}>{log.action}</Badge>
                      </td>
                      <td className="px-4 py-2.5 text-xs">{log.entity || '—'}</td>
                      <td className="px-4 py-2.5 text-xs">{log.details || '—'}</td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground font-mono">{log.ip || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
