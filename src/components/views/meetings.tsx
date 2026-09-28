'use client';

import { ResourceView, type ResourceConfig } from '@/components/resource-view';
import { CalendarDays } from 'lucide-react';

const config: ResourceConfig = {
  "entity": "meetings",
  "title": "Meetings",
  "singular": "Meeting",
  "description": "Scheduled meetings with attendees.",
  icon: CalendarDays,
  "fields": [
    {
      "key": "title",
      "label": "Title",
      "type": "text",
      "required": true,
      "width": "full"
    },
    {
      "key": "location",
      "label": "Location",
      "type": "text"
    },
    {
      "key": "scheduledAt",
      "label": "Start",
      "type": "datetime-local"
    },
    {
      "key": "endedAt",
      "label": "End",
      "type": "datetime-local"
    },
    {
      "key": "notes",
      "label": "Notes",
      "type": "textarea",
      "width": "full"
    },
    {
      "key": "outcome",
      "label": "Outcome",
      "type": "text"
    }
  ]
};

export function MeetingsView() {
  return <ResourceView config={config} />;
}
