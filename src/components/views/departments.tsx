'use client';

import { ResourceView, type ResourceConfig } from '@/components/resource-view';
import { Building } from 'lucide-react';

const config: ResourceConfig = {
  "entity": "departments",
  "title": "Departments",
  "singular": "Department",
  "description": "Departments within your business.",
  icon: Building,
  "fields": [
    {
      "key": "name",
      "label": "Name",
      "type": "text",
      "required": true,
      "width": "full"
    }
  ]
};

export function DepartmentsView() {
  return <ResourceView config={config} />;
}
