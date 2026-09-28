'use client';

import { ResourceView, type ResourceConfig } from '@/components/resource-view';
import { User } from 'lucide-react';

const config: ResourceConfig = {
  "entity": "leads",
  "title": "Leads",
  "singular": "Lead",
  "description": "Track every prospect. Convert leads into customers.",
  icon: User,
  "fields": [
    {
      "key": "name",
      "label": "Name",
      "type": "text",
      "required": true,
      "width": "full"
    },
    {
      "key": "email",
      "label": "Email",
      "type": "email"
    },
    {
      "key": "phone",
      "label": "Phone",
      "type": "tel"
    },
    {
      "key": "company",
      "label": "Company",
      "type": "text"
    },
    {
      "key": "source",
      "label": "Source",
      "type": "select",
      "options": [
        "manual",
        "referral",
        "website",
        "social",
        "cold_call",
        "other"
      ]
    },
    {
      "key": "status",
      "label": "Status",
      "type": "select",
      "options": [
        "New",
        "Contacted",
        "Qualified",
        "Won",
        "Lost"
      ]
    },
    {
      "key": "stage",
      "label": "Stage",
      "type": "select",
      "options": [
        "New",
        "Contacted",
        "Qualified",
        "Won",
        "Lost"
      ]
    },
    {
      "key": "priority",
      "label": "Priority",
      "type": "select",
      "options": [
        "low",
        "medium",
        "high",
        "urgent"
      ]
    },
    {
      "key": "value",
      "label": "Value (₹)",
      "type": "number",
      "showPaise": false
    },
    {
      "key": "tags",
      "label": "Tags",
      "type": "tags"
    },
    {
      "key": "notes",
      "label": "Notes",
      "type": "textarea",
      "width": "full"
    }
  ],
  "filterableByStatus": [
    "New",
    "Contacted",
    "Qualified",
    "Won",
    "Lost"
  ]
};

export function LeadsView() {
  return <ResourceView config={config} />;
}
