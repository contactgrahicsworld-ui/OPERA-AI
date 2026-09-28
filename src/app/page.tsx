'use client';

import { useEffect, useState } from 'react';
import { useNav } from '@/lib/nav';
import { LandingView } from '@/components/views/landing';
import { LoginView } from '@/components/views/login';
import { SignupView } from '@/components/views/signup';
import { AppShell } from '@/components/app-shell';
import { ActionCenter } from '@/components/views/action-center';
import { WhatShouldIDo } from '@/components/views/what-should-i-do';
import { Advisor } from '@/components/views/advisor';
import { LeadsView } from '@/components/views/leads';
import { CustomersView } from '@/components/views/customers';
import { ContactsView } from '@/components/views/contacts';
import { CompaniesView } from '@/components/views/companies';
import { DealsView } from '@/components/views/deals';
import { TasksView } from '@/components/views/tasks';
import { FollowupsView as FollowUpsView } from '@/components/views/followups';
import { CallsView } from '@/components/views/calls';
import { MeetingsView } from '@/components/views/meetings';
import { ActivitiesView } from '@/components/views/activities';
import { QuotationsView } from '@/components/views/quotations';
import { OrdersView } from '@/components/views/orders';
import { PaymentsView } from '@/components/views/payments';
import { InvoicesView } from '@/components/views/invoices';
import { ExpensesView } from '@/components/views/expenses';
import { EmployeesView } from '@/components/views/employees';
import { DepartmentsView } from '@/components/views/departments';
import { AttendanceView } from '@/components/views/attendance';
import { LeavesView } from '@/components/views/leaves';
import { ProductsView } from '@/components/views/products';
import { WarehousesView } from '@/components/views/warehouses';
import { StockView } from '@/components/views/stock';
import { SuppliersView } from '@/components/views/suppliers';
import { PurchaseOrdersView } from '@/components/views/purchase-orders';
import { CampaignsView } from '@/components/views/campaigns';
import { LeadSourcesView } from '@/components/views/lead-sources';
import { AutomationsView } from '@/components/views/automations';
import { CustomFieldsView } from '@/components/views/custom-fields';
import { PipelinesView } from '@/components/views/pipelines';
import { AuditView } from '@/components/views/audit';
import { TeamView } from '@/components/views/team';
import { BusinessDNAView } from '@/components/views/business-dna';
import { AnalyticsView } from '@/components/views/analytics';
import { SuperAdminView } from '@/components/views/super-admin';
import { Loader2 } from 'lucide-react';

export default function Home() {
  const { view, setView, authVerifying, setAuthVerifying } = useNav();
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  // On mount: check session
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/auth');
        const data = await res.json();
        if (data.authenticated) {
          setAuthenticated(true);
          setIsSuperAdmin(!!data.user?.isSuperAdmin);
          // If super admin and no tenant, show super admin view directly
          if (data.user?.isSuperAdmin && !data.tenant) {
            setView('super_admin');
          } else if (data.tenant) {
            setView('action_center');
          } else {
            // Has session but no tenant (edge case) — show landing
            setView('landing');
          }
        } else {
          setAuthenticated(false);
          setView('landing');
        }
      } catch {
        setAuthenticated(false);
        setView('landing');
      } finally {
        setAuthVerifying(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Periodic re-auth (every 5 min) to keep session alive
  useEffect(() => {
    if (authenticated === false) return;
    const id = setInterval(async () => {
      try {
        const res = await fetch('/api/auth');
        const data = await res.json();
        if (!data.authenticated && authenticated === true) {
          setAuthenticated(false);
          setView('landing');
        }
      } catch {}
    }, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [authenticated, setView]);

  if (authVerifying || authenticated === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading OPERA AI…</p>
        </div>
      </div>
    );
  }

  // Public views (only when explicitly chosen or when unauthenticated)
  if (authenticated === false && view !== 'login' && view !== 'signup') {
    return <LandingView />;
  }
  if (view === 'landing') return <LandingView />;
  if (view === 'login') return <LoginView />;
  if (view === 'signup') return <SignupView />;

  // Super admin without tenant
  if (isSuperAdmin && view === 'super_admin') {
    return <AppShell><SuperAdminView /></AppShell>;
  }

  // All authenticated app views go through AppShell
  return <AppShell>{renderView(view)}</AppShell>;
}

function renderView(view: string) {
  switch (view) {
    case 'action_center': return <ActionCenter />;
    case 'what_should_i_do': return <WhatShouldIDo />;
    case 'advisor': return <Advisor />;
    case 'leads': return <LeadsView />;
    case 'customers': return <CustomersView />;
    case 'contacts': return <ContactsView />;
    case 'companies': return <CompaniesView />;
    case 'deals': return <DealsView />;
    case 'tasks': return <TasksView />;
    case 'followups': return <FollowUpsView />;
    case 'calls': return <CallsView />;
    case 'meetings': return <MeetingsView />;
    case 'activities': return <ActivitiesView />;
    case 'quotations': return <QuotationsView />;
    case 'orders': return <OrdersView />;
    case 'payments': return <PaymentsView />;
    case 'invoices': return <InvoicesView />;
    case 'expenses': return <ExpensesView />;
    case 'employees': return <EmployeesView />;
    case 'departments': return <DepartmentsView />;
    case 'attendance': return <AttendanceView />;
    case 'leaves': return <LeavesView />;
    case 'products': return <ProductsView />;
    case 'warehouses': return <WarehousesView />;
    case 'stock': return <StockView />;
    case 'suppliers': return <SuppliersView />;
    case 'purchase_orders': return <PurchaseOrdersView />;
    case 'campaigns': return <CampaignsView />;
    case 'lead_sources': return <LeadSourcesView />;
    case 'automations': return <AutomationsView />;
    case 'custom_fields': return <CustomFieldsView />;
    case 'pipelines': return <PipelinesView />;
    case 'audit': return <AuditView />;
    case 'team': return <TeamView />;
    case 'business_dna': return <BusinessDNAView />;
    case 'analytics': return <AnalyticsView />;
    case 'super_admin': return <SuperAdminView />;
    default: return <ActionCenter />;
  }
}
