'use client';

import { ResourceView, type ResourceConfig } from '@/components/resource-view';
import { TrendingDown } from 'lucide-react';

const config: ResourceConfig = {
  "entity": "expenses",
  "title": "Expenses",
  "singular": "Expense",
  "description": "Money going out of the business.",
  icon: TrendingDown,
  "fields": [
    {
      "key": "description",
      "label": "Description",
      "type": "text",
      "required": true,
      "width": "full"
    },
    {
      "key": "amount",
      "label": "Amount (paise)",
      "type": "number",
      "showPaise": true
    },
    {
      "key": "category",
      "label": "Category",
      "type": "select",
      "options": [
        "general",
        "office",
        "travel",
        "utilities",
        "salaries",
        "marketing",
        "inventory",
        "rent",
        "other"
      ]
    },
    {
      "key": "paidAt",
      "label": "Paid At",
      "type": "datetime-local",
      "showTimeAgo": true
    }
  ],
  "filterableByStatus": [
    "general",
    "office",
    "travel",
    "utilities",
    "salaries",
    "marketing",
    "inventory",
    "rent",
    "other"
  ]
};

export function ExpensesView() {
  return <ResourceView config={config} />;
}
