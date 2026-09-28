'use client';

import { ResourceView, type ResourceConfig } from '@/components/resource-view';
import { Boxes } from 'lucide-react';

const config: ResourceConfig = {
  "entity": "stock",
  "title": "Stock Levels",
  "singular": "Stock Item",
  "description": "Current inventory levels with reorder points.",
  icon: Boxes,
  "fields": [
    {
      "key": "productId",
      "label": "Product ID",
      "type": "text",
      "required": true
    },
    {
      "key": "warehouseId",
      "label": "Warehouse ID",
      "type": "text"
    },
    {
      "key": "quantity",
      "label": "Quantity",
      "type": "number"
    },
    {
      "key": "reorderLevel",
      "label": "Reorder Level",
      "type": "number"
    }
  ]
};

export function StockView() {
  return <ResourceView config={config} />;
}
