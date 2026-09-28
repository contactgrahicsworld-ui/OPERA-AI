'use client';

import { ResourceView, type ResourceConfig } from '@/components/resource-view';
import { UsersRound } from 'lucide-react';

const config: ResourceConfig = {
  "entity": "contacts",
  "title": "Contacts",
  "singular": "Contact",
  "description": "All business contacts — buyers, partners, vendors.",
  icon: UsersRound,
  "fields": [
    {
      "key": "name",
      "label": "Name",
      "type": "text",
      "required": true
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
      "key": "isPrimary",
      "label": "Primary",
      "type": "select",
      "options": [
        "false",
        "true"
      ]
    },
    {
      "key": "tags",
      "label": "Tags",
      "type": "tags"
    }
  ]
};

export function ContactsView() {
  return <ResourceView config={config} />;
}
