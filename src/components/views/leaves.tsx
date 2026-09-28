'use client';

import { ResourceView, type ResourceConfig } from '@/components/resource-view';
import { Plane } from 'lucide-react';

const config: ResourceConfig = {
  "entity": "leaves",
  "title": "Leaves",
  "singular": "Leave",
  "description": "Employee leave applications.",
  icon: Plane,
  "fields": [
    {
      "key": "employeeId",
      "label": "Employee ID",
      "type": "text"
    },
    {
      "key": "type",
      "label": "Type",
      "type": "select",
      "options": [
        "casual",
        "sick",
        "earned",
        "unpaid",
        "other"
      ]
    },
    {
      "key": "startDate",
      "label": "Start",
      "type": "date",
      "showDate": true
    },
    {
      "key": "endDate",
      "label": "End",
      "type": "date",
      "showDate": true
    },
    {
      "key": "status",
      "label": "Status",
      "type": "select",
      "options": [
        "pending",
        "approved",
        "rejected",
        "cancelled"
      ]
    },
    {
      "key": "reason",
      "label": "Reason",
      "type": "textarea",
      "width": "full"
    }
  ],
  "filterableByStatus": [
    "pending",
    "approved",
    "rejected",
    "cancelled"
  ]
};

export function LeavesView() {
  return <ResourceView config={config} />;
}
