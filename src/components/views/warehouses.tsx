'use client';

import { ResourceView, type ResourceConfig } from '@/components/resource-view';
import { Warehouse } from 'lucide-react';

const config: ResourceConfig = {
  "entity": "warehouses",
  "title": "Warehouses",
  "singular": "Warehouse",
  "description": "Storage locations for inventory.",
  icon: Warehouse,
  "fields": [
    {
      "key": "name",
      "label": "Name",
      "type": "text",
      "required": true,
      "width": "full"
    },
    {
      "key": "location",
      "label": "Location",
      "type": "text"
    }
  ]
};

export function WarehousesView() {
  return <ResourceView config={config} />;
}
