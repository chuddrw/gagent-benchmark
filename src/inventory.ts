import { NotImplementedError } from './types.js';
import type { CartItem } from './types.js';

/**
 * In-memory stock reservations.
 * Signature is fixed. Behavior is intentionally unimplemented.
 */
export class InventoryService {
  constructor(initial: Record<string, number>) {
    // TODO: Reject invalid initial stock counts.
    throw new NotImplementedError();
  }

  reserve(orderId: string, items: CartItem[]): void {
    // TODO: Reserve every requested line or none, summing quantities by SKU.
    // TODO: Make the same order id and normalized items a no-op.
    // TODO: Reject a repeated order id whose normalized items differ.
    // TODO: Do not oversell across overlapping calls in this process.
    throw new NotImplementedError();
  }

  getAvailable(sku: string): number {
    // TODO: Report remaining stock for a known SKU.
    throw new NotImplementedError();
  }
}
