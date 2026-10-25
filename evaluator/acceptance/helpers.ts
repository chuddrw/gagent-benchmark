import { expect } from 'vitest';
import type { CartItem, CatalogItem, Coupon, ShopErrorCode } from '../../src/types.js';

/** Coordinator-owned helpers. These files are omitted from benchmark-start. */

export function expectShopError(fn: () => unknown, code: ShopErrorCode): void {
  let caught: unknown;
  try {
    fn();
  } catch (error) {
    caught = error;
  }
  expect(caught, `expected ${code}`).toBeInstanceOf(Error);
  expect(caught).toMatchObject({ code });
  expect((caught as Error).message.trim().length).toBeGreaterThan(0);
}

export function expectOne(
  items: ReadonlyArray<{ sku: string; quantity: number }>,
  sku: string,
  quantity: number,
): void {
  const matches = items.filter((item) => item.sku === sku);
  expect(matches, `sku ${sku}`).toHaveLength(1);
  expect(matches[0]?.quantity).toBe(quantity);
}

export function expectPricedLine(
  items: ReadonlyArray<{ sku: string; quantity: number; priceCents: number; lineTotalCents: number }>,
  sku: string,
  quantity: number,
  priceCents: number,
  lineTotalCents: number,
): void {
  const matches = items.filter((item) => item.sku === sku);
  expect(matches, `sku ${sku}`).toHaveLength(1);
  expect(matches[0]).toMatchObject({ sku, quantity, priceCents, lineTotalCents });
}

export function twoProductCatalog(): CatalogItem[] {
  return [
    { sku: 'MUG', priceCents: 1999 },
    { sku: 'STICKER', priceCents: 250 },
  ];
}

export function welcomeCoupon(): Coupon[] {
  return [{ code: 'WELCOME15', percent: 15, minSubtotalCents: 5000, maxDiscountCents: 750 }];
}

export const publishedBasket: CartItem[] = [
  { sku: 'MUG', quantity: 3 },
  { sku: 'STICKER', quantity: 2 },
];

export const publishedSubtotalCents = 6497;
export const publishedDiscountCents = 750;
export const publishedTotalCents = 5747;
