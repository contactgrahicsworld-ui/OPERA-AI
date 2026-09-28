'use client';

import { ResourceView, type ResourceConfig } from '@/components/resource-view';
import { Globe } from 'lucide-react';

const config: ResourceConfig = {
  "entity": "lead_sources",
  "title": "Lead Sources",
  "singular": "Lead Source",
  "description": "Channels that bring you leads.",
  icon: Globe,
  "fields": [
    {
      "key": "name",
      "label": "Name",
      "type": "text",
      "required": true,
      "width": "full"
    },
    {
      "key": "type",
      "label": "Type",
      "type": "select",
      "options": [
        "manual",
        "web",
        "api",
        "csv",
        "referral"
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
  ]
};

export function LeadSourcesView() {
  return <ResourceView config={config} />;
}
