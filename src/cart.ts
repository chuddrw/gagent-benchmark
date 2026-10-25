import { NotImplementedError } from './types.js';
import type { CatalogItem, CartTotals } from './types.js';

/**
 * Catalog pricing and cart contents.
 * Signature is fixed. Behavior is intentionally unimplemented.
 */
export class CartService {
  constructor(catalog: CatalogItem[]) {
    // TODO: Reject duplicate catalog SKUs and invalid prices.
    throw new NotImplementedError();
  }

  add(sku: string, qty: number): void {
    // TODO: Reject unknown SKUs and invalid quantities.
    // TODO: Accumulate quantity when the same SKU is added again.
    throw new NotImplementedError();
  }

  totals(): CartTotals {
    // TODO: Return one deterministic integer line per SKU and the pre-discount subtotal.
    throw new NotImplementedError();
  }
}
