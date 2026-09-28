'use client';

import { useEffect, useState } from 'react';
import { apiGet, apiPost } from '@/lib/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Users, UserPlus, Shield, Loader2, Power } from 'lucide-react';
import { toast } from 'sonner';

const ROLES = ['OWNER', 'ADMIN', 'MANAGER', 'SALES', 'TELECALLER', 'FIELD_AGENT', 'HR', 'ACCOUNTANT', 'MARKETING', 'VIEWER'];

interface UserRow {
  id: string;
  email: string;
  name?: string;
  role: string;
  status: string;
  createdAt: string;
}

export function TeamView() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);

  // Invite form
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState('SALES');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const data = await apiGet<{ items: UserRow[] }>('/api/users');
      setUsers(data.items || []);
    } catch (e: any) {
      toast.error('Failed: ' + e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function invite() {
    setBusy(true);
    try {
      await apiPost('/api/users?op=invite', { email, name, role, password });
      toast.success('Team member invited');
      setInviteOpen(false);
      setEmail(''); setName(''); setPassword('');
      await load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function changeRole(userId: string, newRole: string) {
    try {
      await apiPost('/api/users?op=update_role', { userId, role: newRole });
      toast.success('Role updated');
      await load();
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  async function deactivate(userId: string) {
    try {
      await apiPost('/api/users?op=deactivate', { userId });
      toast.success('User deactivated');
      await load();
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Users className="h-6 w-6 text-primary" /> Team & Roles
          </h1>
          <p className="text-sm text-muted-foreground">Manage who can access your workspace.</p>
        </div>
        <Button size="sm" onClick={() => setInviteOpen(true)}>
          <UserPlus className="h-4 w-4 mr-1.5" /> Invite member
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 space-y-2">{[1,2,3].map((i) => <Skeleton key={i} className="h-12" />)}</div>
          ) : users.length === 0 ? (
            <div className="p-10 text-center text-muted-foreground">
              <Users className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p className="text-sm">No team members yet.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Name</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Email</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Role</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Status</th>
                  <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b hover:bg-muted/30">
                    <td className="px-4 py-3">{u.name || '—'}</td>
                    <td className="px-4 py-3">{u.email}</td>
                    <td className="px-4 py-3">
                      {u.role === 'OWNER' ? (
                        <Badge className="bg-primary/10 text-primary border-primary/30">{u.role}</Badge>
                      ) : (
                        <Select value={u.role} onValueChange={(v) => changeRole(u.id, v)}>
                          <SelectTrigger className="h-7 text-xs w-32"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {ROLES.filter((r) => r !== 'OWNER').map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={u.status === 'active' ? 'secondary' : 'destructive'} className={u.status === 'active' ? 'bg-green-100 text-green-900' : ''}>
                        {u.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {u.role !== 'OWNER' && (
                        <Button size="sm" variant="ghost" className="h-7 text-destructive text-xs" onClick={() => deactivate(u.id)}>
                          <Power className="h-3 w-3" />
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <div className="text-xs text-muted-foreground bg-muted/30 rounded-md p-3 flex items-start gap-2">
        <Shield className="h-4 w-4 mt-0.5 text-primary shrink-0" />
        <div>
          <p className="font-medium text-foreground mb-0.5">Roles enforced server-side.</p>
          <p>OWNER, ADMIN, MANAGER, SALES, TELECALLER, FIELD_AGENT, HR, ACCOUNTANT, MARKETING, VIEWER.</p>
          <p>Super Admin is platform-level and lives outside any tenant.</p>
        </div>
      </div>

      {/* Invite dialog */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite team member</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label className="text-xs">Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Priya Patel" />
            </div>
            <div>
              <Label className="text-xs">Email</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="priya@business.com" />
            </div>
            <div>
              <Label className="text-xs">Temporary password</Label>
              <Input type="text" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="min 6 chars" />
            </div>
            <div>
              <Label className="text-xs">Role</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROLES.filter((r) => r !== 'OWNER').map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteOpen(false)}>Cancel</Button>
            <Button onClick={invite} disabled={busy || !email || password.length < 6}>
              {busy ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : null}
              Send invite
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
