'use client';

import { ResourceView, type ResourceConfig } from '@/components/resource-view';
import { Wallet } from 'lucide-react';

const config: ResourceConfig = {
  "entity": "payments",
  "title": "Payments",
  "singular": "Payment",
  "description": "Money received from customers.",
  icon: Wallet,
  "fields": [
    {
      "key": "number",
      "label": "Number",
      "type": "text"
    },
    {
      "key": "amount",
      "label": "Amount (paise)",
      "type": "number",
      "showPaise": true
    },
    {
      "key": "method",
      "label": "Method",
      "type": "select",
      "options": [
        "cash",
        "upi",
        "card",
        "bank",
        "cheque",
        "other"
      ]
    },
    {
      "key": "status",
      "label": "Status",
      "type": "select",
      "options": [
        "received",
        "pending",
        "failed",
        "refunded"
      ]
    },
    {
      "key": "paidAt",
      "label": "Paid At",
      "type": "datetime-local",
      "showTimeAgo": true
    }
  ],
  "filterableByStatus": [
    "received",
    "pending",
    "failed",
    "refunded"
  ]
};

export function PaymentsView() {
  return <ResourceView config={config} />;
}
