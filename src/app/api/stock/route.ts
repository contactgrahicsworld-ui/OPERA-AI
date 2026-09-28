// OPERA AI — Stock management (separate from products because of two-table interaction)
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { withTenant, qp, quickAudit, type AuthContext } from '@/lib/api-helpers';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  return withTenant(req, async (ctx: AuthContext) => {
    const items = await db.stockItem.findMany({
      where: { tenantId: ctx.tenantId },
      include: { product: true, warehouse: true },
      orderBy: { updatedAt: 'desc' },
    });
    const lowStock = items.filter((i) => i.quantity <= i.reorderLevel);
    return { items, lowStock };
  });
}

export async function POST(req: NextRequest) {
  return withTenant(req, async (ctx: AuthContext) => {
    const d = await req.json().catch(() => ({}));
    const op = qp(req, 'op', 'set');
    if (op === 'set') {
      // Upsert stock item
      const { productId, warehouseId, quantity, reorderLevel } = d;
      if (!productId) return NextResponse.json({ error: 'productId_required' }, { status: 400 });
      const existing = await db.stockItem.findFirst({
        where: { tenantId: ctx.tenantId, productId, warehouseId: warehouseId || null },
      });
      let item;
      if (existing) {
        const prevQty = existing.quantity;
        item = await db.stockItem.update({
          where: { id: existing.id },
          data: { quantity, reorderLevel },
        });
        await db.stockMovement.create({
          data: {
            tenantId: ctx.tenantId!,
            productId,
            type: 'adjustment',
            quantity: quantity - prevQty,
            toWarehouseId: warehouseId || null,
            refType: 'adjustment',
            refId: existing.id,
            notes: 'Manual stock adjustment',
          },
        });
      } else {
        item = await db.stockItem.create({
          data: { tenantId: ctx.tenantId!, productId, warehouseId: warehouseId || null, quantity: quantity || 0, reorderLevel: reorderLevel || 0 },
        });
        await db.stockMovement.create({
          data: {
            tenantId: ctx.tenantId!,
            productId,
            type: 'in',
            quantity: quantity || 0,
            toWarehouseId: warehouseId || null,
            refType: 'initial',
            refId: item.id,
            notes: 'Initial stock',
          },
        });
      }
      await quickAudit(ctx, 'stock_set', 'stockItem', item.id, `qty=${quantity}`);
      return item;
    }
    if (op === 'movement') {
      const { productId, fromWarehouseId, toWarehouseId, quantity, refType, refId, notes } = d;
      if (!productId || !quantity) return NextResponse.json({ error: 'missing_fields' }, { status: 400 });
      const mv = await db.stockMovement.create({
        data: { tenantId: ctx.tenantId!, productId, type: d.type || 'in', quantity, fromWarehouseId: fromWarehouseId || null, toWarehouseId: toWarehouseId || null, refType: refType || 'manual', refId: refId || null, notes: notes || '' },
      });
      // Adjust stock levels
      if (d.type === 'in' || (!d.type && toWarehouseId)) {
        const existing = await db.stockItem.findFirst({ where: { tenantId: ctx.tenantId!, productId, warehouseId: toWarehouseId || null } });
        if (existing) {
          await db.stockItem.update({ where: { id: existing.id }, data: { quantity: { increment: quantity } } });
        } else {
          await db.stockItem.create({ data: { tenantId: ctx.tenantId!, productId, warehouseId: toWarehouseId || null, quantity, reorderLevel: 0 } });
        }
      } else if (d.type === 'out' && fromWarehouseId) {
        const existing = await db.stockItem.findFirst({ where: { tenantId: ctx.tenantId!, productId, warehouseId: fromWarehouseId } });
        if (existing) {
          await db.stockItem.update({ where: { id: existing.id }, data: { quantity: { decrement: quantity } } });
        }
      } else if (d.type === 'transfer') {
        // decrement source, increment target
        if (fromWarehouseId) {
          const src = await db.stockItem.findFirst({ where: { tenantId: ctx.tenantId!, productId, warehouseId: fromWarehouseId } });
          if (src) await db.stockItem.update({ where: { id: src.id }, data: { quantity: { decrement: quantity } } });
        }
        if (toWarehouseId) {
          const tgt = await db.stockItem.findFirst({ where: { tenantId: ctx.tenantId!, productId, warehouseId: toWarehouseId } });
          if (tgt) {
            await db.stockItem.update({ where: { id: tgt.id }, data: { quantity: { increment: quantity } } });
          } else {
            await db.stockItem.create({ data: { tenantId: ctx.tenantId!, productId, warehouseId: toWarehouseId, quantity, reorderLevel: 0 } });
          }
        }
      }
      await quickAudit(ctx, 'stock_movement', 'stockMovement', mv.id, `type=${d.type} qty=${quantity}`);
      return mv;
    }
    return NextResponse.json({ error: 'unknown_op' }, { status: 400 });
  });
}
