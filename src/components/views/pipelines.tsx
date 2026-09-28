'use client';

import { ResourceView, type ResourceConfig } from '@/components/resource-view';
import { GitBranch } from 'lucide-react';

const config: ResourceConfig = {
  "entity": "pipelines",
  "title": "Pipelines",
  "singular": "Pipeline",
  "description": "Sales pipelines with configurable stages.",
  icon: GitBranch,
  "fields": [
    {
      "key": "name",
      "label": "Name",
      "type": "text",
      "required": true,
      "width": "full"
    },
    {
      "key": "entity",
      "label": "Entity",
      "type": "select",
      "options": [
        "lead",
        "deal",
        "customer"
      ]
    },
    {
      "key": "stages",
      "label": "Stages (CSV)",
      "type": "tags",
      "width": "full"
    },
    {
      "key": "isDefault",
      "label": "Default",
      "type": "select",
      "options": [
        "false",
        "true"
      ]
    }
  ],
  "filterableByStatus": [
    "lead",
    "deal",
    "customer"
  ]
};

export function PipelinesView() {
  return <ResourceView config={config} />;
}
