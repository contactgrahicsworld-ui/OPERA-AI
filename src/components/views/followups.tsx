'use client';

import { ResourceView, type ResourceConfig } from '@/components/resource-view';
import { CalendarClock } from 'lucide-react';

const config: ResourceConfig = {
  "entity": "followups",
  "title": "Follow-ups",
  "singular": "Follow-up",
  "description": "Scheduled follow-ups with leads and customers.",
  icon: CalendarClock,
  "fields": [
    {
      "key": "title",
      "label": "Title",
      "type": "text",
      "required": true,
      "width": "full"
    },
    {
      "key": "dueAt",
      "label": "Due At",
      "type": "datetime-local",
      "showTimeAgo": false
    },
    {
      "key": "outcome",
      "label": "Outcome",
      "type": "text"
    },
    {
      "key": "completedAt",
      "label": "Completed At",
      "type": "datetime-local"
    }
  ]
};

export function FollowupsView() {
  return <ResourceView config={config} />;
}
