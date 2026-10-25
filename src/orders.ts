import { NotImplementedError } from './types.js';
import type { InventoryService } from './inventory.js';
import type { CatalogItem, CheckoutRequest, Coupon, Order } from './types.js';

/**
 * Checkout orchestration and confirmed-order storage.
 * Signature is fixed. Behavior is intentionally unimplemented.
 */
export class OrderService {
  constructor(
    cartCatalog: CatalogItem[],
    coupons: Coupon[],
    inventory: InventoryService,
  ) {
    // TODO: Validate the catalog the same way the cart does.
    throw new NotImplementedError();
  }

  checkout(req: CheckoutRequest): Order {
    // TODO: Validate items, prices, and coupon eligibility before reserving stock.
    // TODO: On success, store a confirmed order. On failure, store nothing and leave stock unchanged.
    // TODO: Replay the same normalized request without reserving again.
    // TODO: Reject a different request that reuses a confirmed order id.
    throw new NotImplementedError();
  }

  getOrder(orderId: string): Order | undefined {
    // TODO: Return the stored confirmed order, or undefined when there is none.
    throw new NotImplementedError();
  }
}
