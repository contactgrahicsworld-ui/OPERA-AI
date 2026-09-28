'use client';

import { ResourceView, type ResourceConfig } from '@/components/resource-view';
import { Users } from 'lucide-react';

const config: ResourceConfig = {
  "entity": "customers",
  "title": "Customers",
  "singular": "Customer",
  "description": "Your paying customers and their lifetime value.",
  icon: Users,
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
      "key": "type",
      "label": "Type",
      "type": "select",
      "options": [
        "individual",
        "business"
      ]
    },
    {
      "key": "status",
      "label": "Status",
      "type": "select",
      "options": [
        "active",
        "inactive",
        "churned"
      ]
    },
    {
      "key": "tags",
      "label": "Tags",
      "type": "tags"
    }
  ],
  "filterableByStatus": [
    "active",
    "inactive",
    "churned"
  ]
};

export function CustomersView() {
  return <ResourceView config={config} />;
}
