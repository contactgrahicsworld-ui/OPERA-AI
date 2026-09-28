'use client';

import { ResourceView, type ResourceConfig } from '@/components/resource-view';
import { Building2 } from 'lucide-react';

const config: ResourceConfig = {
  "entity": "companies",
  "title": "Companies",
  "singular": "Company",
  "description": "Organisations you do business with.",
  icon: Building2,
  "fields": [
    {
      "key": "name",
      "label": "Name",
      "type": "text",
      "required": true,
      "width": "full"
    },
    {
      "key": "industry",
      "label": "Industry",
      "type": "text"
    },
    {
      "key": "website",
      "label": "Website",
      "type": "text"
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
      "key": "address",
      "label": "Address",
      "type": "textarea",
      "width": "full"
    }
  ]
};

export function CompaniesView() {
  return <ResourceView config={config} />;
}
