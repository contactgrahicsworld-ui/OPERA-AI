'use client';

import { useEffect, useState, useMemo } from 'react';
import { useNav } from '@/lib/nav';
import { apiGet, apiPost, apiPatch, apiDelete, formatINR, formatDate, formatDateTime, timeAgo, paiseToINR } from '@/lib/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, Search, Pencil, Trash2, RefreshCw, Inbox } from 'lucide-react';
import { toast } from 'sonner';

// ============================================================
// Schema definitions per entity
// ============================================================

export type FieldType = 'text' | 'email' | 'tel' | 'number' | 'date' | 'datetime-local' | 'textarea' | 'select' | 'tags';

export interface FieldDef {
  key: string;
  label: string;
  type: FieldType;
  options?: string[];
  required?: boolean;
  placeholder?: string;
  hideInList?: boolean;
  showPaise?: boolean; // display as INR
  showDate?: boolean;
  showTimeAgo?: boolean;
  width?: string;
}

export interface ResourceConfig {
  entity: string; // API path, e.g. 'leads'
  title: string;
  singular: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  fields: FieldDef[];
  filterableByStatus?: string[];
}

// ============================================================
// Generic resource view (used for ~25 entity types)
// ============================================================

export function ResourceView({ config }: { config: ResourceConfig }) {
  const { setView } = useNav();
  const [items, setItems] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [editItem, setEditItem] = useState<any | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (statusFilter !== 'all') params.set('status', statusFilter);
      params.set('limit', '50');
      const data = await apiGet<{ items: any[]; total: number }>(`/api/${config.entity}?${params.toString()}`);
      setItems(data.items || []);
      setTotal(data.total || 0);
    } catch (e: any) {
      toast.error('Failed to load: ' + e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const id = setTimeout(load, 250);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, statusFilter]);

  const listFields = config.fields.filter((f) => !f.hideInList).slice(0, 6);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <config.icon className="h-6 w-6 text-primary" />
            {config.title}
          </h1>
          <p className="text-sm text-muted-foreground">{config.description}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-1.5" />
            New {config.singular}
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        {config.filterableByStatus && (
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All status</SelectItem>
              {config.filterableByStatus.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* List */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 space-y-2">
              {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-14 w-full" />)}
            </div>
          ) : items.length === 0 ? (
            <div className="p-10 text-center text-muted-foreground">
              <Inbox className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p className="text-sm">No {config.title.toLowerCase()} found.</p>
              <p className="text-xs mt-1">Try adjusting filters or create a new {config.singular.toLowerCase()}.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">#</th>
                    {listFields.map((f) => (
                      <th key={f.key} className="text-left px-4 py-2.5 font-medium text-muted-foreground whitespace-nowrap">{f.label}</th>
                    ))}
                    <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => (
                    <tr key={item.id} className="border-b hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 text-muted-foreground text-xs">{(idx + 1)}</td>
                      {listFields.map((f) => (
                        <td key={f.key} className="px-4 py-3 whitespace-nowrap">
                          <CellRenderer field={f} value={item[f.key]} item={item} />
                        </td>
                      ))}
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => setEditItem(item)} className="h-8 w-8 p-0">
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => setDeleteId(item.id)} className="h-8 w-8 p-0 text-destructive">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground text-center">
        {items.length} of {total} {config.title.toLowerCase()}
      </p>

      {/* Create modal */}
      <ResourceForm
        open={createOpen}
        onOpenChange={setCreateOpen}
        config={config}
        mode="create"
        onSuccess={() => { setCreateOpen(false); load(); }}
      />

      {/* Edit modal */}
      <ResourceForm
        open={!!editItem}
        onOpenChange={(o) => !o && setEditItem(null)}
        config={config}
        mode="edit"
        initial={editItem}
        onSuccess={() => { setEditItem(null); load(); }}
      />

      {/* Delete confirm */}
      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this {config.singular.toLowerCase()}?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The record will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                try {
                  await apiDelete(`/api/${config.entity}?id=${deleteId}`);
                  toast.success(`${config.singular} deleted`);
                  setDeleteId(null);
                  load();
                } catch (e: any) {
                  toast.error('Delete failed: ' + e.message);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ============================================================
// Cell renderer
// ============================================================

function CellRenderer({ field, value, item }: { field: FieldDef; value: any; item: any }) {
  if (value === null || value === undefined || value === '') {
    return <span className="text-muted-foreground">—</span>;
  }
  if (field.showPaise) {
    return <span className="font-medium">₹{formatINR(paiseToINR(Number(value) || 0))}</span>;
  }
  if (field.showDate) {
    return <span>{formatDate(value)}</span>;
  }
  if (field.showTimeAgo) {
    return <span className="text-muted-foreground">{timeAgo(value)}</span>;
  }
  if (field.type === 'select' && field.options) {
    const tone = statusTone(value);
    return <Badge variant="secondary" className={tone}>{value}</Badge>;
  }
  if (field.type === 'tags') {
    const tags = String(value || '').split(',').filter(Boolean);
    if (tags.length === 0) return <span className="text-muted-foreground">—</span>;
    return (
      <div className="flex flex-wrap gap-1">
        {tags.slice(0, 3).map((t) => (
          <Badge key={t} variant="outline" className="text-[10px]">{t}</Badge>
        ))}
        {tags.length > 3 && <Badge variant="outline" className="text-[10px]">+{tags.length - 3}</Badge>}
      </div>
    );
  }
  // Default text
  const text = String(value);
  return <span className={text.length > 40 ? 'block max-w-[20ch] truncate' : ''} title={text}>{text}</span>;
}

function statusTone(s: string): string {
  const v = (s || '').toLowerCase();
  if (['won', 'paid', 'received', 'approved', 'completed', 'delivered', 'confirmed', 'active', 'present'].includes(v)) return 'bg-green-100 text-green-900';
  if (['lost', 'rejected', 'failed', 'cancelled', 'inactive', 'absent', 'overdue', 'expired'].includes(v)) return 'bg-red-100 text-red-900';
  if (['sent', 'pending', 'planned', 'trial', 'unpaid', 'open', 'in_progress'].includes(v)) return 'bg-amber-100 text-amber-900';
  if (['new', 'draft', 'qualified', 'contacted'].includes(v)) return 'bg-blue-100 text-blue-900';
  return 'bg-muted text-foreground';
}

// ============================================================
// Resource form (create / edit)
// ============================================================

function ResourceForm({
  open,
  onOpenChange,
  config,
  mode,
  initial,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  config: ResourceConfig;
  mode: 'create' | 'edit';
  initial?: any | null;
  onSuccess: () => void;
}) {
  const [values, setValues] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      const init: Record<string, any> = {};
      for (const f of config.fields) {
        let v = initial?.[f.key] ?? '';
        if (f.type === 'tags' && typeof v === 'string') v = v.split(',').filter(Boolean);
        if ((f.type === 'date' || f.type === 'datetime-local') && v) {
          try {
            v = new Date(v).toISOString().slice(0, f.type === 'date' ? 10 : 16);
          } catch {}
        }
        init[f.key] = v;
      }
      setValues(init);
    }
  }, [open, initial, config]);

  function setField(key: string, value: any) {
    setValues((p) => ({ ...p, [key]: value }));
  }

  async function save() {
    setSaving(true);
    try {
      // Build payload: convert tags arrays to CSV, numbers to numbers
      const payload: Record<string, any> = {};
      for (const f of config.fields) {
        let v = values[f.key];
        if (v === undefined || v === '') {
          if (f.required) throw new Error(`${f.label} is required`);
          continue;
        }
        if (f.type === 'number') v = Number(v);
        if (f.type === 'tags' && Array.isArray(v)) v = v.join(','); // tags saved as CSV by API
        payload[f.key] = v;
      }
      if (mode === 'create') {
        await apiPost(`/api/${config.entity}`, payload);
        toast.success(`${config.singular} created`);
      } else {
        await apiPatch(`/api/${config.entity}?id=${initial.id}`, payload);
        toast.success(`${config.singular} updated`);
      }
      onSuccess();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {mode === 'create' ? `New ${config.singular}` : `Edit ${config.singular}`}
          </DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 py-2">
          {config.fields.map((f) => (
            <div key={f.key} className={`space-y-1 ${f.width === 'full' ? 'sm:col-span-2' : ''}`}>
              <Label htmlFor={f.key} className="text-xs">
                {f.label} {f.required && <span className="text-destructive">*</span>}
              </Label>
              {f.type === 'textarea' ? (
                <Textarea
                  id={f.key}
                  value={values[f.key] ?? ''}
                  onChange={(e) => setField(f.key, e.target.value)}
                  rows={3}
                  placeholder={f.placeholder || ''}
                />
              ) : f.type === 'select' ? (
                <Select value={values[f.key] ?? ''} onValueChange={(v) => setField(f.key, v)}>
                  <SelectTrigger id={f.key}>
                    <SelectValue placeholder={`Select ${f.label.toLowerCase()}…`} />
                  </SelectTrigger>
                  <SelectContent>
                    {f.options?.map((o) => (
                      <SelectItem key={o} value={o}>{o}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : f.type === 'tags' ? (
                <Input
                  value={(Array.isArray(values[f.key]) ? values[f.key] : []).join(', ')}
                  onChange={(e) => setField(f.key, e.target.value.split(',').map((s) => s.trim()).filter(Boolean))}
                  placeholder="comma, separated, tags"
                />
              ) : (
                <Input
                  id={f.key}
                  type={f.type === 'tel' ? 'tel' : f.type === 'email' ? 'email' : f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : f.type === 'datetime-local' ? 'datetime-local' : 'text'}
                  value={values[f.key] ?? ''}
                  onChange={(e) => setField(f.key, e.target.value)}
                  placeholder={f.placeholder || ''}
                />
              )}
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving}>
            {saving ? 'Saving…' : mode === 'create' ? 'Create' : 'Save changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
