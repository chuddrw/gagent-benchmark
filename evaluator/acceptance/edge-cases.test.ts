import { describe, expect, it } from 'vitest';
import { CartService } from '../../src/cart.js';
import { InventoryService } from '../../src/inventory.js';
import { OrderService } from '../../src/orders.js';
import { expectOne, expectShopError, twoProductCatalog } from './helpers.js';

describe('edge cases and invalid inputs', () => {
  it.each([
    ['negative', -1],
    ['zero', 0],
    ['fractional', 1.5],
    ['NaN', Number.NaN],
    ['Infinity', Number.POSITIVE_INFINITY],
  ])('rejects a %s purchase quantity without changing the cart', (_label, quantity) => {
    const cart = new CartService(twoProductCatalog());
    cart.add('MUG', 1);
    expectShopError(() => cart.add('MUG', quantity), 'INVALID_INPUT');
    expect(cart.totals().subtotalCents).toBe(1999);
    expectOne(cart.totals().items, 'MUG', 1);
  });

  it.each([
    ['negative', -1],
    ['fractional', 10.5],
    ['NaN', Number.NaN],
    ['Infinity', Number.POSITIVE_INFINITY],
  ])('rejects a %s catalog price', (_label, priceCents) => {
    expectShopError(
      () => new CartService([{ sku: 'MUG', priceCents }]),
      'INVALID_INPUT',
    );
  });

  it('rejects invalid checkout quantities and unknown SKUs before stock changes', () => {
    const inventory = new InventoryService({ MUG: 2, STICKER: 2 });
    const orders = new OrderService(twoProductCatalog(), [], inventory);
    expectShopError(
      () => orders.checkout({ orderId: 'ord-1', items: [{ sku: 'MUG', quantity: -2 }] }),
      'INVALID_INPUT',
    );
    expectShopError(
      () => orders.checkout({ orderId: 'ord-1', items: [{ sku: 'MUG', quantity: 1.2 }] }),
      'INVALID_INPUT',
    );
    expectShopError(
      () => orders.checkout({ orderId: '', items: [{ sku: 'MUG', quantity: 1 }] }),
      'INVALID_INPUT',
    );
    expectShopError(
      () => orders.checkout({ orderId: 'ord-2', items: [{ sku: 'POSTER', quantity: 1 }] }),
      'UNKNOWN_SKU',
    );
    expect(orders.getOrder('ord-1')).toBeUndefined();
    expect(orders.getOrder('ord-2')).toBeUndefined();
    expect(inventory.getAvailable('MUG')).toBe(2);
    expect(inventory.getAvailable('STICKER')).toBe(2);
  });

  it('rejects an invalid catalog price from the order service without using stock', () => {
    const inventory = new InventoryService({ MUG: 2 });
    expectShopError(
      () => new OrderService([{ sku: 'MUG', priceCents: -5 }], [], inventory),
      'INVALID_INPUT',
    );
    expect(inventory.getAvailable('MUG')).toBe(2);
  });

  it('treats a catalog SKU that inventory does not track as unknown', () => {
    const inventory = new InventoryService({ STICKER: 2 });
    const orders = new OrderService(twoProductCatalog(), [], inventory);
    expectShopError(
      () => orders.checkout({ orderId: 'ord-1', items: [{ sku: 'MUG', quantity: 1 }] }),
      'UNKNOWN_SKU',
    );
    expect(orders.getOrder('ord-1')).toBeUndefined();
    expect(inventory.getAvailable('STICKER')).toBe(2);
  });

  it('rejects a zero-quantity line inside a multi-SKU checkout', () => {
    const inventory = new InventoryService({ MUG: 2, STICKER: 2 });
    const orders = new OrderService(twoProductCatalog(), [], inventory);
    expectShopError(
      () =>
        orders.checkout({
          orderId: 'ord-1',
          items: [
            { sku: 'MUG', quantity: 1 },
            { sku: 'STICKER', quantity: 0 },
          ],
        }),
      'INVALID_INPUT',
    );
    expect(inventory.getAvailable('MUG')).toBe(2);
    expect(inventory.getAvailable('STICKER')).toBe(2);
  });
});
