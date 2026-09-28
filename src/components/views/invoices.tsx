'use client';

import { ResourceView, type ResourceConfig } from '@/components/resource-view';
import { Receipt } from 'lucide-react';

const config: ResourceConfig = {
  "entity": "invoices",
  "title": "Invoices",
  "singular": "Invoice",
  "description": "Bills raised on customers.",
  icon: Receipt,
  "fields": [
    {
      "key": "number",
      "label": "Number",
      "type": "text"
    },
    {
      "key": "totalAmount",
      "label": "Total (paise)",
      "type": "number",
      "showPaise": true
    },
    {
      "key": "status",
      "label": "Status",
      "type": "select",
      "options": [
        "unpaid",
        "partial",
        "paid",
        "overdue",
        "cancelled"
      ]
    },
    {
      "key": "dueDate",
      "label": "Due Date",
      "type": "date",
      "showDate": true
    }
  ],
  "filterableByStatus": [
    "unpaid",
    "partial",
    "paid",
    "overdue",
    "cancelled"
  ]
};

export function InvoicesView() {
  return <ResourceView config={config} />;
}
