'use client';

import { ResourceView, type ResourceConfig } from '@/components/resource-view';
import { Package } from 'lucide-react';

const config: ResourceConfig = {
  "entity": "products",
  "title": "Products & Services",
  "singular": "Product",
  "description": "Things you sell — physical or service.",
  icon: Package,
  "fields": [
    {
      "key": "name",
      "label": "Name",
      "type": "text",
      "required": true,
      "width": "full"
    },
    {
      "key": "sku",
      "label": "SKU",
      "type": "text"
    },
    {
      "key": "type",
      "label": "Type",
      "type": "select",
      "options": [
        "product",
        "service"
      ]
    },
    {
      "key": "category",
      "label": "Category",
      "type": "text"
    },
    {
      "key": "price",
      "label": "Price (paise)",
      "type": "number",
      "showPaise": true
    },
    {
      "key": "cost",
      "label": "Cost (paise)",
      "type": "number",
      "showPaise": true
    },
    {
      "key": "unit",
      "label": "Unit",
      "type": "text"
    },
    {
      "key": "taxRate",
      "label": "Tax Rate (%)",
      "type": "number"
    },
    {
      "key": "description",
      "label": "Description",
      "type": "textarea",
      "width": "full"
    }
  ],
  "filterableByStatus": [
    "product",
    "service"
  ]
};

export function ProductsView() {
  return <ResourceView config={config} />;
}
