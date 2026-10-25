import { describe, expect, it } from 'vitest';
import { CartService } from '../../src/cart.js';
import {
  expectOne,
  expectPricedLine,
  expectShopError,
  publishedSubtotalCents,
  twoProductCatalog,
} from './helpers.js';

describe('cart operations and pricing', () => {
  it('rejects a catalog with a duplicate SKU', () => {
    expectShopError(
      () =>
        new CartService([
          { sku: 'MUG', priceCents: 100 },
          { sku: 'MUG', priceCents: 200 },
        ]),
      'INVALID_INPUT',
    );
  });

  it('treats SKU identity as case-sensitive', () => {
    const cart = new CartService([
      { sku: 'Mug', priceCents: 100 },
      { sku: 'mug', priceCents: 300 },
    ]);
    cart.add('Mug', 1);
    cart.add('mug', 2);
    const totals = cart.totals();
    expectPricedLine(totals.items, 'Mug', 1, 100, 100);
    expectPricedLine(totals.items, 'mug', 2, 300, 600);
    expect(totals.subtotalCents).toBe(700);
  });

  it('accepts a zero price and prices an empty cart at zero', () => {
    const cart = new CartService([{ sku: 'FREE', priceCents: 0 }]);
    expect(cart.totals()).toEqual({ items: [], subtotalCents: 0 });
    cart.add('FREE', 4);
    expectPricedLine(cart.totals().items, 'FREE', 4, 0, 0);
    expect(cart.totals().subtotalCents).toBe(0);
  });

  it('accumulates repeated adds and prices the published basket in integer cents', () => {
    const cart = new CartService(twoProductCatalog());
    cart.add('MUG', 1);
    cart.add('STICKER', 2);
    cart.add('MUG', 2);

    const totals = cart.totals();
    expect(totals.items).toHaveLength(2);
    expectPricedLine(totals.items, 'MUG', 3, 1999, 5997);
    expectPricedLine(totals.items, 'STICKER', 2, 250, 500);
    expect(totals.subtotalCents).toBe(publishedSubtotalCents);
    expect(cart.totals()).toEqual(totals);
  });

  it('rejects an unknown SKU without changing lines already in the cart', () => {
    const cart = new CartService(twoProductCatalog());
    cart.add('MUG', 1);
    expectShopError(() => cart.add('mug', 1), 'UNKNOWN_SKU');
    expectShopError(() => cart.add('POSTER', 1), 'UNKNOWN_SKU');
    const totals = cart.totals();
    expect(totals.items).toHaveLength(1);
    expectOne(totals.items, 'MUG', 1);
    expect(totals.subtotalCents).toBe(1999);
  });

  it('rejects an empty SKU', () => {
    expectShopError(
      () => new CartService([{ sku: '', priceCents: 100 }]),
      'INVALID_INPUT',
    );
  });

  it('does not mutate the catalog array passed by the caller', () => {
    const catalog = twoProductCatalog();
    const snapshot = structuredClone(catalog);
    const cart = new CartService(catalog);
    cart.add('MUG', 1);
    cart.totals();
    expect(catalog).toEqual(snapshot);
  });
});
