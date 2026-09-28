'use client';

import { ResourceView, type ResourceConfig } from '@/components/resource-view';
import { ListTodo } from 'lucide-react';

const config: ResourceConfig = {
  "entity": "activities",
  "title": "Activities",
  "singular": "Activity",
  "description": "Log of all customer and lead interactions.",
  icon: ListTodo,
  "fields": [
    {
      "key": "type",
      "label": "Type",
      "type": "select",
      "options": [
        "call",
        "meeting",
        "email",
        "note",
        "task",
        "visit",
        "other"
      ]
    },
    {
      "key": "title",
      "label": "Title",
      "type": "text",
      "required": true,
      "width": "full"
    },
    {
      "key": "description",
      "label": "Description",
      "type": "textarea",
      "width": "full"
    },
    {
      "key": "outcome",
      "label": "Outcome",
      "type": "text"
    },
    {
      "key": "scheduledAt",
      "label": "Scheduled At",
      "type": "datetime-local"
    },
    {
      "key": "completedAt",
      "label": "Completed At",
      "type": "datetime-local"
    }
  ],
  "filterableByStatus": [
    "call",
    "meeting",
    "email",
    "note",
    "task",
    "visit",
    "other"
  ]
};

export function ActivitiesView() {
  return <ResourceView config={config} />;
}
