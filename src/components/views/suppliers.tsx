'use client';

import { ResourceView, type ResourceConfig } from '@/components/resource-view';
import { Truck } from 'lucide-react';

const config: ResourceConfig = {
  "entity": "suppliers",
  "title": "Suppliers",
  "singular": "Supplier",
  "description": "Vendors who supply your inventory.",
  icon: Truck,
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
      "key": "address",
      "label": "Address",
      "type": "textarea",
      "width": "full"
    }
  ]
};

export function SuppliersView() {
  return <ResourceView config={config} />;
}
