'use client';

import { create } from 'zustand';

export type View =
  | 'landing'
  | 'login'
  | 'signup'
  | 'onboarding' // not used now (signup handles onboarding)
  | 'dashboard'
  | 'action_center'
  | 'what_should_i_do'
  | 'advisor'
  | 'leads'
  | 'customers'
  | 'contacts'
  | 'companies'
  | 'deals'
  | 'tasks'
  | 'followups'
  | 'calls'
  | 'meetings'
  | 'activities'
  | 'quotations'
  | 'orders'
  | 'payments'
  | 'invoices'
  | 'expenses'
  | 'employees'
  | 'departments'
  | 'attendance'
  | 'leaves'
  | 'products'
  | 'warehouses'
  | 'stock'
  | 'suppliers'
  | 'purchase_orders'
  | 'campaigns'
  | 'lead_sources'
  | 'automations'
  | 'custom_fields'
  | 'pipelines'
  | 'audit'
  | 'team'
  | 'business_dna'
  | 'analytics'
  | 'super_admin'
  | 'billing'
  | 'super_admin_payments'
  | 'first_admin_setup'
  | 'recovery';

interface NavState {
  view: View;
  setView: (v: View) => void;
  sidebarOpen: boolean;
  setSidebarOpen: (b: boolean) => void;
  authVerifying: boolean;
  setAuthVerifying: (b: boolean) => void;
}

export const useNav = create<NavState>((set) => ({
  view: 'landing',
  setView: (v) => {
    set({ view: v });
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'instant' as any });
    }
  },
  sidebarOpen: false,
  setSidebarOpen: (b) => set({ sidebarOpen: b }),
  authVerifying: true,
  setAuthVerifying: (b) => set({ authVerifying: b }),
}));
