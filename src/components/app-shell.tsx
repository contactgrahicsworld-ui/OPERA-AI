'use client';

import { useEffect, useState } from 'react';
import { useNav, type View } from '@/lib/nav';
import { apiPost, apiGet } from '@/lib/client';
import {
  LayoutDashboard as ActionIcon,
  Brain,
  Sparkles,
  Users,
  User,
  Building2,
  Handshake,
  CheckSquare,
  CalendarClock,
  Phone,
  CalendarDays,
  ListTodo,
  FileText,
  ShoppingCart,
  Wallet,
  Receipt,
  TrendingDown,
  Briefcase,
  Building,
  CalendarCheck,
  Plane,
  Package,
  Warehouse,
  Boxes,
  Truck,
  ClipboardList,
  Megaphone,
  Globe,
  Workflow,
  Settings2,
  GitBranch,
  ScrollText,
  UsersRound,
  Dna,
  BarChart3,
  Shield,
  LogOut,
  Menu,
  X,
  Bell,
  Search,
  ChevronDown,
  Loader2,
  CreditCard,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';

interface User {
  id: string;
  email: string;
  name?: string;
  role: string;
  isSuperAdmin: boolean;
  tenantId?: string | null;
}
interface Tenant {
  id: string;
  name: string;
  slug: string;
  status: string;
}

interface NavItem {
  id: View;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  group: string;
  badge?: number;
  superAdminOnly?: boolean;
}

const NAV: NavItem[] = [
  { id: 'action_center', label: 'Action Center', icon: ActionIcon, group: 'AI' },
  { id: 'what_should_i_do', label: 'What Should I Do?', icon: Sparkles, group: 'AI' },
  { id: 'advisor', label: 'AI Advisor', icon: Brain, group: 'AI' },
  { id: 'analytics', label: 'Analytics', icon: BarChart3, group: 'AI' },

  { id: 'leads', label: 'Leads', icon: User, group: 'CRM' },
  { id: 'customers', label: 'Customers', icon: Users, group: 'CRM' },
  { id: 'contacts', label: 'Contacts', icon: UsersRound, group: 'CRM' },
  { id: 'companies', label: 'Companies', icon: Building2, group: 'CRM' },
  { id: 'deals', label: 'Deals', icon: Handshake, group: 'CRM' },

  { id: 'tasks', label: 'Tasks', icon: CheckSquare, group: 'Operations' },
  { id: 'followups', label: 'Follow-ups', icon: CalendarClock, group: 'Operations' },
  { id: 'calls', label: 'Calls', icon: Phone, group: 'Operations' },
  { id: 'meetings', label: 'Meetings', icon: CalendarDays, group: 'Operations' },
  { id: 'activities', label: 'Activities', icon: ListTodo, group: 'Operations' },

  { id: 'quotations', label: 'Quotations', icon: FileText, group: 'Sales' },
  { id: 'orders', label: 'Orders', icon: ShoppingCart, group: 'Sales' },
  { id: 'payments', label: 'Payments', icon: Wallet, group: 'Sales' },
  { id: 'invoices', label: 'Invoices', icon: Receipt, group: 'Sales' },
  { id: 'expenses', label: 'Expenses', icon: TrendingDown, group: 'Sales' },

  { id: 'employees', label: 'Employees', icon: Briefcase, group: 'Team' },
  { id: 'departments', label: 'Departments', icon: Building, group: 'Team' },
  { id: 'attendance', label: 'Attendance', icon: CalendarCheck, group: 'Team' },
  { id: 'leaves', label: 'Leaves', icon: Plane, group: 'Team' },

  { id: 'products', label: 'Products', icon: Package, group: 'Inventory' },
  { id: 'warehouses', label: 'Warehouses', icon: Warehouse, group: 'Inventory' },
  { id: 'stock', label: 'Stock', icon: Boxes, group: 'Inventory' },
  { id: 'suppliers', label: 'Suppliers', icon: Truck, group: 'Inventory' },
  { id: 'purchase_orders', label: 'Purchase Orders', icon: ClipboardList, group: 'Inventory' },

  { id: 'campaigns', label: 'Campaigns', icon: Megaphone, group: 'Marketing' },
  { id: 'lead_sources', label: 'Lead Sources', icon: Globe, group: 'Marketing' },

  { id: 'automations', label: 'Automations', icon: Workflow, group: 'Settings' },
  { id: 'custom_fields', label: 'Custom Fields', icon: Settings2, group: 'Settings' },
  { id: 'pipelines', label: 'Pipelines', icon: GitBranch, group: 'Settings' },
  { id: 'business_dna', label: 'Business DNA', icon: Dna, group: 'Settings' },
  { id: 'team', label: 'Team & Roles', icon: Users, group: 'Settings' },
  { id: 'audit', label: 'Audit Log', icon: ScrollText, group: 'Settings' },

  { id: 'super_admin', label: 'Super Admin', icon: Shield, group: 'Platform', superAdminOnly: true },
  { id: 'super_admin_payments', label: 'Payments Dashboard', icon: CreditCard, group: 'Platform', superAdminOnly: true },
  { id: 'billing', label: 'Billing', icon: CreditCard, group: 'AI' },
];

const GROUP_ORDER = ['AI', 'CRM', 'Operations', 'Sales', 'Team', 'Inventory', 'Marketing', 'Settings', 'Platform'];

export function AppShell({ children }: { children: React.ReactNode }) {
  const { view, setView, sidebarOpen, setSidebarOpen } = useNav();
  const [user, setUser] = useState<User | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [notificationCount, setNotificationCount] = useState(0);
  const [searchOpen, setSearchOpen] = useState(false);
  const [actionCount, setActionCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [auth, ai] = await Promise.all([
          apiGet<{ authenticated: boolean; user: User; tenant: Tenant }>('/api/auth'),
          apiGet<{ actions: any[]; insights: any[] }>('/api/ai?limit=100').catch(() => ({ actions: [], insights: [] })),
        ]);
        if (auth.authenticated) {
          setUser(auth.user);
          setTenant(auth.tenant);
          setActionCount(ai.actions?.filter((a) => a.status === 'pending').length || 0);
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    })();
  }, [view]);

  async function handleLogout() {
    try {
      await apiPost('/api/auth?action=logout');
      window.location.href = '/';
    } catch {
      toast.error('Logout failed');
    }
  }

  async function seedDemoData() {
    try {
      const res = await apiPost('/api/seed-demo');
      toast.success(`Seeded ${res.counts.leads} leads, ${res.counts.customers} customers, ${res.counts.quotations} quotations`);
      setTimeout(() => window.location.reload(), 1500);
    } catch (e: any) {
      if (e.message === 'tenant_has_data') {
        toast.info('Your workspace already has data.');
      } else {
        toast.error('Failed to seed demo data: ' + e.message);
      }
    }
  }

  const groupedNav = GROUP_ORDER.map((g) => ({
    group: g,
    items: NAV.filter((n) => {
      // Must belong to this group
      if (n.group !== g) return false;
      // Filter out super-admin-only items for non-SA users
      if (n.superAdminOnly && !user?.isSuperAdmin) return false;
      // If user is SA without tenant, show only Platform items
      if (user?.isSuperAdmin && !user?.tenantId && n.group !== 'Platform') return false;
      return true;
    }),
  })).filter((g) => g.items.length > 0);

  const sidebarContent = (
    <div className="flex flex-col h-full bg-sidebar text-sidebar-foreground">
      {/* Logo */}
      <button
        onClick={() => setView('action_center')}
        className="flex items-center gap-2 px-4 py-4 border-b border-sidebar-border hover:bg-sidebar-accent/40 transition-colors"
      >
        <div className="h-9 w-9 rounded-lg bg-primary text-primary-foreground flex items-center justify-center font-bold text-lg">O</div>
        <div className="text-left">
          <div className="font-semibold leading-tight">OPERA AI</div>
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider">AI Business Operator</div>
        </div>
      </button>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-2 custom-scrollbar">
        {groupedNav.map(({ group, items }) => (
          <div key={group} className="mb-3">
            <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{group}</div>
            <div className="space-y-0.5">
              {items.map((item) => {
                const Icon = item.icon;
                const active = view === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setView(item.id);
                      setSidebarOpen(false);
                    }}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors ${
                      active
                        ? 'bg-sidebar-primary text-sidebar-primary-foreground font-medium'
                        : 'text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground'
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="flex-1 text-left truncate">{item.label}</span>
                    {item.id === 'action_center' && actionCount > 0 && (
                      <span className="text-[10px] bg-primary text-primary-foreground rounded-full px-1.5 py-0.5 font-semibold">
                        {actionCount}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      {tenant && (
        <div className="border-t border-sidebar-border p-2 space-y-1">
          <button
            onClick={seedDemoData}
            className="w-full text-xs px-3 py-2 rounded-md text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground text-left"
          >
            + Seed demo data
          </button>
        </div>
      )}
    </div>
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden lg:block w-64 shrink-0 border-r border-sidebar-border">
        {sidebarContent}
      </aside>

      {/* Mobile sidebar */}
      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent side="left" className="w-72 p-0 max-w-[85vw]">
          {sidebarContent}
        </SheetContent>
      </Sheet>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar */}
        <header className="h-14 border-b border-border bg-background flex items-center px-3 lg:px-6 gap-2 shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-2 rounded-md hover:bg-muted"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>

          {/* Breadcrumb / current view title */}
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-sm font-medium truncate">
              {NAV.find((n) => n.id === view)?.label || 'OPERA AI'}
            </span>
            {tenant && (
              <Badge variant="outline" className="hidden sm:inline-flex text-[10px]">
                {tenant.name}
              </Badge>
            )}
            {tenant?.status === 'trial' && (
              <Badge variant="secondary" className="text-[10px] bg-amber-100 text-amber-900">Trial</Badge>
            )}
          </div>

          <div className="flex-1" />

          {/* Quick actions */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setView('what_should_i_do')}
            className="hidden md:inline-flex text-primary"
          >
            <Sparkles className="h-4 w-4 mr-1.5" />
            What should I do?
          </Button>

          {/* User menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 p-1 rounded-full hover:bg-muted transition-colors">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                    {(user?.name || user?.email || '?')[0]?.toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <ChevronDown className="h-4 w-4 hidden sm:block text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div className="flex flex-col">
                  <span className="font-medium">{user?.name || 'User'}</span>
                  <span className="text-xs text-muted-foreground font-normal">{user?.email}</span>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setView('business_dna')}>
                <Dna className="h-4 w-4 mr-2" /> Business DNA
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setView('team')}>
                <Users className="h-4 w-4 mr-2" /> Team & Roles
              </DropdownMenuItem>
              {user?.isSuperAdmin && (
                <DropdownMenuItem onClick={() => setView('super_admin')}>
                  <Shield className="h-4 w-4 mr-2" /> Super Admin
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="text-destructive">
                <LogOut className="h-4 w-4 mr-2" /> Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-x-hidden bg-muted/20">
          <div className="max-w-7xl mx-auto p-4 lg:p-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
