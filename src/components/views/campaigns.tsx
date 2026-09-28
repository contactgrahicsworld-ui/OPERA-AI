'use client';

import { ResourceView, type ResourceConfig } from '@/components/resource-view';
import { Megaphone } from 'lucide-react';

const config: ResourceConfig = {
  "entity": "campaigns",
  "title": "Campaigns",
  "singular": "Campaign",
  "description": "Marketing campaigns by channel.",
  icon: Megaphone,
  "fields": [
    {
      "key": "name",
      "label": "Name",
      "type": "text",
      "required": true,
      "width": "full"
    },
    {
      "key": "channel",
      "label": "Channel",
      "type": "select",
      "options": [
        "manual",
        "email",
        "social",
        "web",
        "sms"
      ]
    },
    {
      "key": "status",
      "label": "Status",
      "type": "select",
      "options": [
        "planned",
        "active",
        "paused",
        "completed"
      ]
    },
    {
      "key": "budget",
      "label": "Budget (paise)",
      "type": "number",
      "showPaise": true
    },
    {
      "key": "spent",
      "label": "Spent (paise)",
      "type": "number",
      "showPaise": true
    },
    {
      "key": "startDate",
      "label": "Start",
      "type": "date",
      "showDate": true
    },
    {
      "key": "endDate",
      "label": "End",
      "type": "date",
      "showDate": true
    }
  ],
  "filterableByStatus": [
    "planned",
    "active",
    "paused",
    "completed"
  ]
};

export function CampaignsView() {
  return <ResourceView config={config} />;
}
