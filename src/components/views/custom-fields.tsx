'use client';

import { ResourceView, type ResourceConfig } from '@/components/resource-view';
import { Settings2 } from 'lucide-react';

const config: ResourceConfig = {
  "entity": "custom_fields",
  "title": "Custom Fields",
  "singular": "Custom Field",
  "description": "Add custom fields to any entity.",
  icon: Settings2,
  "fields": [
    {
      "key": "entity",
      "label": "Entity",
      "type": "select",
      "options": [
        "lead",
        "customer",
        "contact",
        "deal",
        "quotation",
        "order",
        "task"
      ]
    },
    {
      "key": "key",
      "label": "Key",
      "type": "text",
      "required": true
    },
    {
      "key": "label",
      "label": "Label",
      "type": "text",
      "required": true
    },
    {
      "key": "type",
      "label": "Type",
      "type": "select",
      "options": [
        "text",
        "number",
        "date",
        "select",
        "multiselect",
        "boolean"
      ]
    },
    {
      "key": "isRequired",
      "label": "Required",
      "type": "select",
      "options": [
        "false",
        "true"
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
  ],
  "filterableByStatus": [
    "lead",
    "customer",
    "contact",
    "deal",
    "quotation",
    "order",
    "task"
  ]
};

export function CustomFieldsView() {
  return <ResourceView config={config} />;
}
