'use client';

import { ResourceView, type ResourceConfig } from '@/components/resource-view';
import { FileText } from 'lucide-react';

const config: ResourceConfig = {
  "entity": "quotations",
  "title": "Quotations",
  "singular": "Quotation",
  "description": "Price quotes sent to leads and customers.",
  icon: FileText,
  "fields": [
    {
      "key": "subject",
      "label": "Subject",
      "type": "text",
      "required": true,
      "width": "full"
    },
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
        "draft",
        "sent",
        "approved",
        "rejected",
        "expired",
        "converted"
      ]
    },
    {
      "key": "validTill",
      "label": "Valid Till",
      "type": "date",
      "showDate": true
    }
  ],
  "filterableByStatus": [
    "draft",
    "sent",
    "approved",
    "rejected",
    "expired",
    "converted"
  ]
};

export function QuotationsView() {
  return <ResourceView config={config} />;
}
