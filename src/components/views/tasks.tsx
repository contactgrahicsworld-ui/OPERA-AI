'use client';

import { ResourceView, type ResourceConfig } from '@/components/resource-view';
import { CheckSquare } from 'lucide-react';

const config: ResourceConfig = {
  "entity": "tasks",
  "title": "Tasks",
  "singular": "Task",
  "description": "All actionable work — yours and your team's.",
  icon: CheckSquare,
  "fields": [
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
      "key": "type",
      "label": "Type",
      "type": "select",
      "options": [
        "general",
        "follow_up",
        "collection",
        "visit",
        "call",
        "custom"
      ]
    },
    {
      "key": "status",
      "label": "Status",
      "type": "select",
      "options": [
        "open",
        "in_progress",
        "done",
        "overdue",
        "cancelled"
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
      "key": "dueDate",
      "label": "Due Date",
      "type": "date",
      "showDate": true
    }
  ],
  "filterableByStatus": [
    "open",
    "in_progress",
    "done",
    "overdue",
    "cancelled"
  ]
};

export function TasksView() {
  return <ResourceView config={config} />;
}
