'use client';

import { ResourceView, type ResourceConfig } from '@/components/resource-view';
import { CalendarCheck } from 'lucide-react';

const config: ResourceConfig = {
  "entity": "attendance",
  "title": "Attendance",
  "singular": "Attendance",
  "description": "Daily attendance records for employees.",
  icon: CalendarCheck,
  "fields": [
    {
      "key": "employeeId",
      "label": "Employee ID",
      "type": "text"
    },
    {
      "key": "date",
      "label": "Date",
      "type": "date",
      "showDate": true
    },
    {
      "key": "checkIn",
      "label": "Check In",
      "type": "datetime-local"
    },
    {
      "key": "checkOut",
      "label": "Check Out",
      "type": "datetime-local"
    },
    {
      "key": "status",
      "label": "Status",
      "type": "select",
      "options": [
        "present",
        "absent",
        "leave",
        "half_day",
        "late"
      ]
    },
    {
      "key": "notes",
      "label": "Notes",
      "type": "textarea",
      "width": "full"
    }
  ],
  "filterableByStatus": [
    "present",
    "absent",
    "leave",
    "half_day",
    "late"
  ]
};

export function AttendanceView() {
  return <ResourceView config={config} />;
}
