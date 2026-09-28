'use client';

import { ResourceView, type ResourceConfig } from '@/components/resource-view';
import { ShoppingCart } from 'lucide-react';

const config: ResourceConfig = {
  "entity": "orders",
  "title": "Orders",
  "singular": "Order",
  "description": "Confirmed orders from customers.",
  icon: ShoppingCart,
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
        "pending",
        "confirmed",
        "shipped",
        "delivered",
        "cancelled",
        "returned"
      ]
    }
  ],
  "filterableByStatus": [
    "pending",
    "confirmed",
    "shipped",
    "delivered",
    "cancelled",
    "returned"
  ]
};

export function OrdersView() {
  return <ResourceView config={config} />;
}
