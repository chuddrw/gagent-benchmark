import { NotImplementedError } from './types.js';
import type { Coupon, DiscountResult } from './types.js';

/**
 * Percent-off coupon calculation.
 * Signature is fixed. Behavior is intentionally unimplemented.
 */
export function applyCoupon(
  subtotalCents: number,
  couponCode: string | undefined,
  coupons: Coupon[],
): DiscountResult {
  // TODO: Treat a missing coupon code as no discount.
  // TODO: Look up the selected code case-insensitively and enforce its minimum subtotal.
  // TODO: Discount Math.floor(subtotalCents * percent / 100), then apply maxDiscountCents.
  // TODO: Reject unknown and ineligible coupons with ShopError. Keep the total nonnegative.
  throw new NotImplementedError();
}
