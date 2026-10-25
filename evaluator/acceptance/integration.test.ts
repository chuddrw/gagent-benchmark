import { describe, expect, it } from 'vitest';
import { CartService } from '../../src/cart.js';
import { applyCoupon } from '../../src/discounts.js';
import { InventoryService } from '../../src/inventory.js';
import { OrderService } from '../../src/orders.js';
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

describe('cross-module checkout', () => {
  it('prices in the cart, discounts with the coupon helper, and reserves through checkout', () => {
    const catalog = twoProductCatalog();
    const coupons = welcomeCoupon();
    const inventory = new InventoryService({ MUG: 4, STICKER: 2 });
    const cart = new CartService(catalog);
    const orders = new OrderService(catalog, coupons, inventory);

    cart.add('MUG', 3);
    cart.add('STICKER', 1);
    cart.add('STICKER', 1);
    const totals = cart.totals();
    const quote = applyCoupon(totals.subtotalCents, 'WELCOME15', coupons);

    expect(totals.subtotalCents).toBe(publishedSubtotalCents);
    expect(quote).toEqual({
      discountCents: publishedDiscountCents,
      totalCents: publishedTotalCents,
    });

    const order = orders.checkout({
      orderId: 'weekend-1',
      items: totals.items.map(({ sku, quantity }) => ({ sku, quantity })),
      couponCode: 'welcome15',
    });

    expect(order.subtotalCents).toBe(totals.subtotalCents);
    expect(order.discountCents).toBe(quote.discountCents);
    expect(order.totalCents).toBe(quote.totalCents);
    expect(order.status).toBe('confirmed');
    expect(inventory.getAvailable('MUG')).toBe(1);
    expect(inventory.getAvailable('STICKER')).toBe(0);

    const replay = orders.checkout({
      orderId: 'weekend-1',
      items: [...publishedBasket].reverse(),
      couponCode: 'WELCOME15',
    });
    expect(replay).toEqual(order);
    expect(inventory.getAvailable('MUG')).toBe(1);
    expect(inventory.getAvailable('STICKER')).toBe(0);

    expectShopError(
      () =>
        orders.checkout({
          orderId: 'weekend-2',
          items: [{ sku: 'STICKER', quantity: 1 }],
        }),
      'OUT_OF_STOCK',
    );
    expect(orders.getOrder('weekend-2')).toBeUndefined();
    expect(inventory.getAvailable('STICKER')).toBe(0);

    const lastMug = orders.checkout({
      orderId: 'weekend-3',
      items: [{ sku: 'MUG', quantity: 1 }],
    });
    expect(lastMug.totalCents).toBe(1999);
    expect(lastMug.discountCents).toBe(0);
    expect(inventory.getAvailable('MUG')).toBe(0);
    expect(orders.getOrder('weekend-3')).toEqual(lastMug);
  });

  it('keeps cart subtotals pre-discount and still agrees with checkout', () => {
    const catalog = twoProductCatalog();
    const coupons = welcomeCoupon();
    const inventory = new InventoryService({ MUG: 3, STICKER: 2 });
    const cart = new CartService(catalog.map((item) => ({ ...item })));
    const orders = new OrderService(catalog, coupons, inventory);

    cart.add('MUG', 3);
    cart.add('STICKER', 2);
    const before = cart.totals();
    orders.checkout({
      orderId: 'ord-1',
      items: publishedBasket,
      couponCode: 'WELCOME15',
    });
    expect(cart.totals()).toEqual(before);
    expect(orders.getOrder('ord-1')?.subtotalCents).toBe(before.subtotalCents);
    expectOne(orders.getOrder('ord-1')?.items ?? [], 'MUG', 3);
  });

  it('does not take stock for a bad coupon and then completes a later order', () => {
    const catalog = [{ sku: 'MUG', priceCents: 1999 }];
    const inventory = new InventoryService({ MUG: 1 });
    const orders = new OrderService(catalog, welcomeCoupon(), inventory);
    const items = [{ sku: 'MUG', quantity: 1 }];

    expectShopError(
      () => orders.checkout({ orderId: 'ord-1', items, couponCode: 'MISSING' }),
      'UNKNOWN_COUPON',
    );
    expect(inventory.getAvailable('MUG')).toBe(1);
    expect(orders.getOrder('ord-1')).toBeUndefined();

    const order = orders.checkout({ orderId: 'ord-1', items });
    expect(order.totalCents).toBe(1999);
    expect(inventory.getAvailable('MUG')).toBe(0);
    expect(orders.checkout({ orderId: 'ord-1', items })).toEqual(order);
    expect(inventory.getAvailable('MUG')).toBe(0);
  });
});
