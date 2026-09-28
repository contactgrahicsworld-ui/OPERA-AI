'use client';

import { ResourceView, type ResourceConfig } from '@/components/resource-view';
import { ClipboardList } from 'lucide-react';

const config: ResourceConfig = {
  "entity": "purchase_orders",
  "title": "Purchase Orders",
  "singular": "PO",
  "description": "Purchase orders raised on suppliers.",
  icon: ClipboardList,
  "fields": [
    {
      "key": "number",
      "label": "Number",
      "type": "text"
    },
    {
      "key": "supplierId",
      "label": "Supplier ID",
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
        "draft",
        "sent",
        "received",
        "cancelled"
      ]
    }
  ],
  "filterableByStatus": [
    "draft",
    "sent",
    "received",
    "cancelled"
  ]
};

export function PurchaseOrdersView() {
  return <ResourceView config={config} />;
}
