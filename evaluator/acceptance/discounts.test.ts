import { describe, expect, it } from 'vitest';
import { applyCoupon } from '../../src/discounts.js';
import type { Coupon } from '../../src/types.js';
import {
  expectShopError,
  publishedDiscountCents,
  publishedSubtotalCents,
  publishedTotalCents,
  welcomeCoupon,
} from './helpers.js';

describe('discount eligibility and calculations', () => {
  it('treats a missing coupon as a zero discount', () => {
    const coupons = welcomeCoupon();
    const snapshot = structuredClone(coupons);
    expect(applyCoupon(publishedSubtotalCents, undefined, coupons)).toEqual({
      discountCents: 0,
      totalCents: publishedSubtotalCents,
    });
    expect(applyCoupon(0, undefined, [])).toEqual({ discountCents: 0, totalCents: 0 });
    expect(coupons).toEqual(snapshot);
  });

  it('does not validate unselected coupons when no code is requested', () => {
    const coupons: Coupon[] = [{ code: 'BAD', percent: 500, minSubtotalCents: -1 }];
    expect(applyCoupon(1000, undefined, coupons)).toEqual({
      discountCents: 0,
      totalCents: 1000,
    });
  });

  it('floors 15 percent of 999 cents to 149', () => {
    const result = applyCoupon(999, 'save15', [
      { code: 'SAVE15', percent: 15, minSubtotalCents: 0 },
    ]);
    expect(result).toEqual({ discountCents: 149, totalCents: 850 });
  });

  it('caps the published 15 percent basket at 750 cents', () => {
    const result = applyCoupon(publishedSubtotalCents, 'welcome15', welcomeCoupon());
    expect(result).toEqual({
      discountCents: publishedDiscountCents,
      totalCents: publishedTotalCents,
    });
  });

  it('does not raise a discount up to a cap above the raw percent', () => {
    const result = applyCoupon(999, 'SAVE15', [
      { code: 'SAVE15', percent: 15, minSubtotalCents: 0, maxDiscountCents: 1000 },
    ]);
    expect(result).toEqual({ discountCents: 149, totalCents: 850 });
  });

  it('uses the first case-insensitive match when codes repeat', () => {
    const result = applyCoupon(1000, 'save', [
      { code: 'SAVE', percent: 10, minSubtotalCents: 0 },
      { code: 'save', percent: 50, minSubtotalCents: 0 },
    ]);
    expect(result).toEqual({ discountCents: 100, totalCents: 900 });
  });

  it('ignores a different coupon in the same list', () => {
    const result = applyCoupon(1000, 'TEN', [
      { code: 'HALF', percent: 50, minSubtotalCents: 0 },
      { code: 'TEN', percent: 10, minSubtotalCents: 0 },
    ]);
    expect(result).toEqual({ discountCents: 100, totalCents: 900 });
  });

  it('treats a subtotal equal to the minimum as eligible', () => {
    const result = applyCoupon(5000, 'WELCOME15', [
      { code: 'WELCOME15', percent: 15, minSubtotalCents: 5000 },
    ]);
    expect(result).toEqual({ discountCents: 750, totalCents: 4250 });
  });

  it('rejects a known coupon below its minimum', () => {
    expectShopError(
      () =>
        applyCoupon(4999, 'WELCOME15', [
          { code: 'WELCOME15', percent: 15, minSubtotalCents: 5000 },
        ]),
      'INELIGIBLE_COUPON',
    );
  });

  it('rejects an unknown coupon', () => {
    expectShopError(() => applyCoupon(999, 'NOPE', welcomeCoupon()), 'UNKNOWN_COUPON');
  });

  it('allows 0 and 100 percent and keeps the total nonnegative', () => {
    expect(applyCoupon(250, 'FREE', [{ code: 'FREE', percent: 100, minSubtotalCents: 0 }])).toEqual({
      discountCents: 250,
      totalCents: 0,
    });
    expect(applyCoupon(250, 'NONE', [{ code: 'NONE', percent: 0, minSubtotalCents: 0 }])).toEqual({
      discountCents: 0,
      totalCents: 250,
    });
  });

  it('honors a zero cap', () => {
    expect(
      applyCoupon(1000, 'SAVE', [
        { code: 'SAVE', percent: 50, minSubtotalCents: 0, maxDiscountCents: 0 },
      ]),
    ).toEqual({ discountCents: 0, totalCents: 1000 });
  });

  it('rejects an invalid selected coupon or subtotal', () => {
    const valid = welcomeCoupon();
    expectShopError(() => applyCoupon(1000, 'SAVE', [{ code: 'SAVE', percent: 101, minSubtotalCents: 0 }]), 'INVALID_INPUT');
    expectShopError(() => applyCoupon(1000, 'SAVE', [{ code: 'SAVE', percent: -1, minSubtotalCents: 0 }]), 'INVALID_INPUT');
    expectShopError(() => applyCoupon(1000, 'SAVE', [{ code: 'SAVE', percent: 10.5, minSubtotalCents: 0 }]), 'INVALID_INPUT');
    expectShopError(
      () => applyCoupon(1000, 'SAVE', [{ code: 'SAVE', percent: 10, minSubtotalCents: -1 }]),
      'INVALID_INPUT',
    );
    expectShopError(
      () =>
        applyCoupon(1000, 'SAVE', [
          { code: 'SAVE', percent: 10, minSubtotalCents: 0, maxDiscountCents: -5 },
        ]),
      'INVALID_INPUT',
    );
    expectShopError(() => applyCoupon(-1, undefined, valid), 'INVALID_INPUT');
    expectShopError(() => applyCoupon(1.5, undefined, valid), 'INVALID_INPUT');
    expectShopError(() => applyCoupon(Number.NaN, undefined, valid), 'INVALID_INPUT');
  });
});
