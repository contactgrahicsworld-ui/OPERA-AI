'use client';

import { ResourceView, type ResourceConfig } from '@/components/resource-view';
import { Workflow } from 'lucide-react';

const config: ResourceConfig = {
  "entity": "automations",
  "title": "Automations",
  "singular": "Automation",
  "description": "Trigger → Conditions → Actions workflow rules.",
  icon: Workflow,
  "fields": [
    {
      "key": "name",
      "label": "Name",
      "type": "text",
      "required": true,
      "width": "full"
    },
    {
      "key": "trigger",
      "label": "Trigger",
      "type": "select",
      "options": [
        "new_lead",
        "quotation_inactive",
        "payment_overdue",
        "low_stock",
        "customer_inactive",
        "manual",
        "scheduled"
      ]
    },
    {
      "key": "requiresApproval",
      "label": "Requires Approval",
      "type": "select",
      "options": [
        "false",
        "true"
      ]
    },
    {
      "key": "isActive",
      "label": "Active",
      "type": "select",
      "options": [
        "true",
        "false"
      ]
    }
  ],
  "filterableByStatus": [
    "new_lead",
    "quotation_inactive",
    "payment_overdue",
    "low_stock",
    "customer_inactive",
    "manual",
    "scheduled"
  ]
};

export function AutomationsView() {
  return <ResourceView config={config} />;
}
