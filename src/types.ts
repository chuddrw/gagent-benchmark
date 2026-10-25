/**
 * Frozen MiniShop public types.
 * Product code reports failures with ShopError.
 * NotImplementedError is starter scaffolding, not a shop error code.
 */

export type CatalogItem = { sku: string; priceCents: number };
export type CartItem = { sku: string; quantity: number };
export type CartTotals = {
  items: Array<CartItem & { priceCents: number; lineTotalCents: number }>;
  subtotalCents: number;
};
export type Coupon = {
  code: string;
  percent: number;
  minSubtotalCents: number;
  maxDiscountCents?: number;
};
export type DiscountResult = { discountCents: number; totalCents: number };
export type CheckoutRequest = {
  orderId: string;
  items: CartItem[];
  couponCode?: string;
};
export type Order = {
  orderId: string;
  items: CartItem[];
  subtotalCents: number;
  discountCents: number;
  totalCents: number;
  status: 'confirmed';
};
export type ShopErrorCode =
  | 'INVALID_INPUT'
  | 'UNKNOWN_SKU'
  | 'UNKNOWN_COUPON'
  | 'INELIGIBLE_COUPON'
  | 'OUT_OF_STOCK'
  | 'ORDER_ID_CONFLICT'
  | 'EMPTY_CART';

export class ShopError extends Error {
  readonly code: ShopErrorCode;

  constructor(code: ShopErrorCode, message: string) {
    super(message);
    this.name = 'ShopError';
    this.code = code;
  }
}

export class NotImplementedError extends Error {
  constructor() {
    super('Not implemented');
    this.name = 'NotImplementedError';
  }
}
