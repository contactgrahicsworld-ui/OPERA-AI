'use client';

import { ResourceView, type ResourceConfig } from '@/components/resource-view';
import { Handshake } from 'lucide-react';

const config: ResourceConfig = {
  "entity": "deals",
  "title": "Deals",
  "singular": "Deal",
  "description": "Open opportunities with potential revenue.",
  icon: Handshake,
  "fields": [
    {
      "key": "title",
      "label": "Title",
      "type": "text",
      "required": true,
      "width": "full"
    },
    {
      "key": "value",
      "label": "Value (₹)",
      "type": "number"
    },
    {
      "key": "stage",
      "label": "Stage",
      "type": "select",
      "options": [
        "New",
        "Qualified",
        "Proposal",
        "Negotiation",
        "Won",
        "Lost"
      ]
    },
    {
      "key": "probability",
      "label": "Probability (%)",
      "type": "number"
    },
    {
      "key": "expectedCloseDate",
      "label": "Expected Close",
      "type": "date",
      "showDate": true
    }
  ],
  "filterableByStatus": [
    "New",
    "Qualified",
    "Proposal",
    "Negotiation",
    "Won",
    "Lost"
  ]
};

export function DealsView() {
  return <ResourceView config={config} />;
}
