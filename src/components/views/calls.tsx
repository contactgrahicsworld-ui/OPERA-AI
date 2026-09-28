'use client';

import { ResourceView, type ResourceConfig } from '@/components/resource-view';
import { Phone } from 'lucide-react';

const config: ResourceConfig = {
  "entity": "calls",
  "title": "Calls",
  "singular": "Call",
  "description": "Telecalling activity log with outcomes.",
  icon: Phone,
  "fields": [
    {
      "key": "direction",
      "label": "Direction",
      "type": "select",
      "options": [
        "inbound",
        "outbound"
      ]
    },
    {
      "key": "status",
      "label": "Status",
      "type": "select",
      "options": [
        "planned",
        "connected",
        "missed",
        "failed"
      ]
    },
    {
      "key": "outcome",
      "label": "Outcome",
      "type": "text"
    },
    {
      "key": "duration",
      "label": "Duration (s)",
      "type": "number"
    },
    {
      "key": "notes",
      "label": "Notes",
      "type": "textarea",
      "width": "full"
    },
    {
      "key": "nextFollowUpAt",
      "label": "Next Follow-up",
      "type": "datetime-local"
    }
  ],
  "filterableByStatus": [
    "planned",
    "connected",
    "missed",
    "failed"
  ]
};

export function CallsView() {
  return <ResourceView config={config} />;
}
