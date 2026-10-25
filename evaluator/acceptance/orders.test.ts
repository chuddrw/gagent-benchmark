import { describe, expect, it } from 'vitest';
import { InventoryService } from '../../src/inventory.js';
import { OrderService } from '../../src/orders.js';
import type { CartItem } from '../../src/types.js';
import {
  expectOne,
  expectShopError,
  publishedBasket,
  publishedDiscountCents,
  publishedSubtotalCents,
  publishedTotalCents,
  twoProductCatalog,
  welcomeCoupon,
} from './helpers.js';

function shop(stock: Record<string, number> = { MUG: 10, STICKER: 10 }) {
  const inventory = new InventoryService(stock);
  const orders = new OrderService(twoProductCatalog(), welcomeCoupon(), inventory);
  return { inventory, orders };
}

describe('checkout and order lifecycle', () => {
  it('checks out the published basket with a case-insensitive capped coupon', () => {
    const { inventory, orders } = shop();
    const order = orders.checkout({
      orderId: 'ord-1',
      items: publishedBasket,
      couponCode: 'welcome15',
    });

    expect(order).toMatchObject({
      orderId: 'ord-1',
      subtotalCents: publishedSubtotalCents,
      discountCents: publishedDiscountCents,
      totalCents: publishedTotalCents,
      status: 'confirmed',
    });
    expect(order.subtotalCents - order.discountCents).toBe(order.totalCents);
    expectOne(order.items, 'MUG', 3);
    expectOne(order.items, 'STICKER', 2);
    expect(inventory.getAvailable('MUG')).toBe(7);
    expect(inventory.getAvailable('STICKER')).toBe(8);
    expect(orders.getOrder('ord-1')).toEqual(order);
  });

  it('checks out without a coupon when the code is omitted', () => {
    const { orders } = shop();
    const order = orders.checkout({ orderId: 'ord-1', items: [{ sku: 'MUG', quantity: 1 }] });
    expect(order.discountCents).toBe(0);
    expect(order.subtotalCents).toBe(1999);
    expect(order.totalCents).toBe(1999);
  });

  it('returns the stored order for a normalized replay and does not reserve twice', () => {
    const { inventory, orders } = shop({ MUG: 3, STICKER: 2 });
    const first = orders.checkout({
      orderId: 'ord-1',
      items: [
        { sku: 'MUG', quantity: 1 },
        { sku: 'STICKER', quantity: 2 },
        { sku: 'MUG', quantity: 2 },
      ],
      couponCode: 'WELCOME15',
    });
    const replay = orders.checkout({
      orderId: 'ord-1',
      items: [
        { sku: 'STICKER', quantity: 2 },
        { sku: 'MUG', quantity: 3 },
      ],
      couponCode: 'welcome15',
    });

    expect(replay).toEqual(first);
    expect(inventory.getAvailable('MUG')).toBe(0);
    expect(inventory.getAvailable('STICKER')).toBe(0);
    expect(orders.getOrder('missing')).toBeUndefined();
  });

  it('treats an omitted coupon and an explicit undefined coupon as the same request', () => {
    const { inventory, orders } = shop({ MUG: 1, STICKER: 0 });
    const items: CartItem[] = [{ sku: 'MUG', quantity: 1 }];
    const first = orders.checkout({ orderId: 'ord-1', items });
    const second = orders.checkout({ orderId: 'ord-1', items, couponCode: undefined });
    expect(second).toEqual(first);
    expect(inventory.getAvailable('MUG')).toBe(0);
  });

  it('replays a confirmed order after stock can no longer satisfy it', () => {
    const { inventory, orders } = shop({ MUG: 1, STICKER: 0 });
    const items: CartItem[] = [{ sku: 'MUG', quantity: 1 }];
    const first = orders.checkout({ orderId: 'ord-1', items });
    const second = orders.checkout({ orderId: 'ord-1', items });
    expect(second).toEqual(first);
    expect(inventory.getAvailable('MUG')).toBe(0);
  });

  it('rejects a changed request for a confirmed id without touching stock or the stored order', () => {
    const { inventory, orders } = shop({ MUG: 5, STICKER: 5 });
    const original = orders.checkout({ orderId: 'ord-1', items: publishedBasket });
    expect(original.discountCents).toBe(0);
    expectShopError(
      () =>
        orders.checkout({
          orderId: 'ord-1',
          items: publishedBasket,
          couponCode: 'WELCOME15',
        }),
      'ORDER_ID_CONFLICT',
    );
    expectShopError(
      () => orders.checkout({ orderId: 'ord-1', items: [{ sku: 'MUG', quantity: 1 }] }),
      'ORDER_ID_CONFLICT',
    );
    expect(orders.getOrder('ord-1')).toEqual(original);
    expect(inventory.getAvailable('MUG')).toBe(2);
    expect(inventory.getAvailable('STICKER')).toBe(3);
  });

  it('reports a conflict even when the changed request is also out of stock', () => {
    const { inventory, orders } = shop({ MUG: 1, STICKER: 0 });
    const original = orders.checkout({
      orderId: 'ord-1',
      items: [{ sku: 'MUG', quantity: 1 }],
    });
    expectShopError(
      () => orders.checkout({ orderId: 'ord-1', items: [{ sku: 'MUG', quantity: 2 }] }),
      'ORDER_ID_CONFLICT',
    );
    expect(orders.getOrder('ord-1')).toEqual(original);
    expect(inventory.getAvailable('MUG')).toBe(0);
  });

  it('lets a later checkout reuse an order id after a failed attempt', () => {
    const { inventory, orders } = shop({ MUG: 1, STICKER: 0 });
    expectShopError(
      () =>
        orders.checkout({
          orderId: 'ord-1',
          items: [{ sku: 'MUG', quantity: 1 }],
          couponCode: 'NOPE',
        }),
      'UNKNOWN_COUPON',
    );
    expect(orders.getOrder('ord-1')).toBeUndefined();
    expect(inventory.getAvailable('MUG')).toBe(1);

    const order = orders.checkout({
      orderId: 'ord-1',
      items: [{ sku: 'MUG', quantity: 1 }],
    });
    expect(order.status).toBe('confirmed');
    expect(inventory.getAvailable('MUG')).toBe(0);
  });

  it('does not store an order or change stock when coupon eligibility fails', () => {
    const { inventory, orders } = shop({ MUG: 1, STICKER: 1 });
    expectShopError(
      () =>
        orders.checkout({
          orderId: 'ord-1',
          items: [{ sku: 'STICKER', quantity: 1 }],
          couponCode: 'WELCOME15',
        }),
      'INELIGIBLE_COUPON',
    );
    expect(orders.getOrder('ord-1')).toBeUndefined();
    expect(inventory.getAvailable('MUG')).toBe(1);
    expect(inventory.getAvailable('STICKER')).toBe(1);
  });

  it('does not store an order or change stock when any line is short', () => {
    const { inventory, orders } = shop({ MUG: 3, STICKER: 1 });
    expectShopError(() => orders.checkout({ orderId: 'ord-1', items: publishedBasket }), 'OUT_OF_STOCK');
    expect(orders.getOrder('ord-1')).toBeUndefined();
    expect(inventory.getAvailable('MUG')).toBe(3);
    expect(inventory.getAvailable('STICKER')).toBe(1);
  });

  it('rejects an empty cart before touching stock', () => {
    const { inventory, orders } = shop();
    expectShopError(() => orders.checkout({ orderId: 'ord-1', items: [] }), 'EMPTY_CART');
    expect(orders.getOrder('ord-1')).toBeUndefined();
    expect(inventory.getAvailable('MUG')).toBe(10);
  });

  it('keeps a snapshot when the caller later mutates the request', () => {
    const { orders } = shop();
    const items: CartItem[] = [{ sku: 'MUG', quantity: 1 }];
    const order = orders.checkout({ orderId: 'ord-1', items });
    items[0]!.quantity = 9;
    expectOne(orders.getOrder('ord-1')?.items ?? [], 'MUG', 1);
    expect(orders.getOrder('ord-1')).toEqual(order);
  });

  it('decrements the inventory instance supplied to the constructor', () => {
    const inventory = new InventoryService({ MUG: 2, STICKER: 2 });
    const orders = new OrderService(twoProductCatalog(), [], inventory);
    orders.checkout({ orderId: 'ord-1', items: [{ sku: 'MUG', quantity: 2 }] });
    expect(inventory.getAvailable('MUG')).toBe(0);
    expect(inventory.getAvailable('STICKER')).toBe(2);
  });

  it('rejects a duplicate catalog SKU when the order service is constructed', () => {
    const inventory = new InventoryService({ MUG: 1 });
    expectShopError(
      () =>
        new OrderService(
          [
            { sku: 'MUG', priceCents: 100 },
            { sku: 'MUG', priceCents: 200 },
          ],
          [],
          inventory,
        ),
      'INVALID_INPUT',
    );
    expect(inventory.getAvailable('MUG')).toBe(1);
  });
});
