'use client';

import { ResourceView, type ResourceConfig } from '@/components/resource-view';
import { Briefcase } from 'lucide-react';

const config: ResourceConfig = {
  "entity": "employees",
  "title": "Employees",
  "singular": "Employee",
  "description": "Your team — including non-login staff.",
  icon: Briefcase,
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
      "key": "position",
      "label": "Position",
      "type": "text"
    },
    {
      "key": "type",
      "label": "Type",
      "type": "select",
      "options": [
        "full_time",
        "part_time",
        "contract",
        "intern"
      ]
    },
    {
      "key": "status",
      "label": "Status",
      "type": "select",
      "options": [
        "active",
        "inactive"
      ]
    },
    {
      "key": "salary",
      "label": "Salary (₹/mo)",
      "type": "number"
    },
    {
      "key": "joinedAt",
      "label": "Joined At",
      "type": "date",
      "showDate": true
    }
  ],
  "filterableByStatus": [
    "active",
    "inactive"
  ]
};

export function EmployeesView() {
  return <ResourceView config={config} />;
}
