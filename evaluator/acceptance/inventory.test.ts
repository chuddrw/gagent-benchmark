import { describe, expect, it } from 'vitest';
import { InventoryService } from '../../src/inventory.js';
import type { CartItem } from '../../src/types.js';
import { expectShopError } from './helpers.js';

function turn<T>(fn: () => T): Promise<T> {
  return Promise.resolve().then(fn);
}

describe('inventory reservations and idempotency', () => {
  it('returns initial stock and treats zero as a known SKU', () => {
    const inventory = new InventoryService({ MUG: 4, STICKER: 0 });
    expect(inventory.getAvailable('MUG')).toBe(4);
    expect(inventory.getAvailable('STICKER')).toBe(0);
    expectShopError(() => inventory.getAvailable('POSTER'), 'UNKNOWN_SKU');
  });

  it('rejects invalid initial stock', () => {
    expectShopError(() => new InventoryService({ MUG: -1 }), 'INVALID_INPUT');
    expectShopError(() => new InventoryService({ MUG: 1.5 }), 'INVALID_INPUT');
    expectShopError(() => new InventoryService({ '': 1 }), 'INVALID_INPUT');
  });

  it('reserves a whole multi-SKU list exactly once', () => {
    const inventory = new InventoryService({ MUG: 4, STICKER: 2 });
    inventory.reserve('ord-1', [
      { sku: 'MUG', quantity: 3 },
      { sku: 'STICKER', quantity: 2 },
    ]);
    expect(inventory.getAvailable('MUG')).toBe(1);
    expect(inventory.getAvailable('STICKER')).toBe(0);
  });

  it('sums duplicate SKU lines before reserving', () => {
    const inventory = new InventoryService({ MUG: 4 });
    inventory.reserve('ord-1', [
      { sku: 'MUG', quantity: 1 },
      { sku: 'MUG', quantity: 2 },
    ]);
    expect(inventory.getAvailable('MUG')).toBe(1);
  });

  it('leaves every SKU unchanged when one line is short', () => {
    const inventory = new InventoryService({ MUG: 4, STICKER: 1 });
    expectShopError(
      () =>
        inventory.reserve('ord-1', [
          { sku: 'MUG', quantity: 1 },
          { sku: 'STICKER', quantity: 2 },
        ]),
      'OUT_OF_STOCK',
    );
    expect(inventory.getAvailable('MUG')).toBe(4);
    expect(inventory.getAvailable('STICKER')).toBe(1);
  });

  it('leaves stock unchanged when a SKU is unknown', () => {
    const inventory = new InventoryService({ MUG: 4 });
    expectShopError(
      () =>
        inventory.reserve('ord-1', [
          { sku: 'MUG', quantity: 1 },
          { sku: 'POSTER', quantity: 1 },
        ]),
      'UNKNOWN_SKU',
    );
    expect(inventory.getAvailable('MUG')).toBe(4);
  });

  it('does not keep an order id after a failed reserve', () => {
    const inventory = new InventoryService({ MUG: 2 });
    expectShopError(() => inventory.reserve('ord-1', [{ sku: 'MUG', quantity: 5 }]), 'OUT_OF_STOCK');
    inventory.reserve('ord-1', [{ sku: 'MUG', quantity: 1 }]);
    expect(inventory.getAvailable('MUG')).toBe(1);
  });

  it('replays the same normalized reservation without decrementing again', () => {
    const inventory = new InventoryService({ MUG: 5, STICKER: 5 });
    const first: CartItem[] = [
      { sku: 'MUG', quantity: 1 },
      { sku: 'MUG', quantity: 1 },
      { sku: 'STICKER', quantity: 2 },
    ];
    inventory.reserve('ord-1', first);
    inventory.reserve('ord-1', [
      { sku: 'STICKER', quantity: 2 },
      { sku: 'MUG', quantity: 2 },
    ]);
    expect(inventory.getAvailable('MUG')).toBe(3);
    expect(inventory.getAvailable('STICKER')).toBe(3);
  });

  it('rejects a different payload for an existing reservation id', () => {
    const inventory = new InventoryService({ MUG: 5, STICKER: 5 });
    inventory.reserve('ord-1', [
      { sku: 'MUG', quantity: 2 },
      { sku: 'STICKER', quantity: 1 },
    ]);
    expectShopError(
      () => inventory.reserve('ord-1', [{ sku: 'MUG', quantity: 2 }]),
      'ORDER_ID_CONFLICT',
    );
    expect(inventory.getAvailable('MUG')).toBe(3);
    expect(inventory.getAvailable('STICKER')).toBe(4);
  });

  it('rejects an empty reservation and invalid quantities without changing stock', () => {
    const inventory = new InventoryService({ MUG: 2 });
    expectShopError(() => inventory.reserve('ord-1', []), 'EMPTY_CART');
    expectShopError(() => inventory.reserve('', [{ sku: 'MUG', quantity: 1 }]), 'INVALID_INPUT');
    expectShopError(() => inventory.reserve('ord-1', [{ sku: 'MUG', quantity: 0 }]), 'INVALID_INPUT');
    expect(inventory.getAvailable('MUG')).toBe(2);
  });

  it('does not mutate the caller item list', () => {
    const inventory = new InventoryService({ MUG: 2, STICKER: 2 });
    const items: CartItem[] = [
      { sku: 'STICKER', quantity: 1 },
      { sku: 'MUG', quantity: 1 },
    ];
    const snapshot = structuredClone(items);
    inventory.reserve('ord-1', items);
    expect(items).toEqual(snapshot);
  });

  it('does not oversell when two reservations are scheduled together', async () => {
    const inventory = new InventoryService({ MUG: 1 });
    const results = await Promise.allSettled([
      turn(() => inventory.reserve('a', [{ sku: 'MUG', quantity: 1 }])),
      turn(() => inventory.reserve('b', [{ sku: 'MUG', quantity: 1 }])),
    ]);
    const fulfilled = results.filter((result) => result.status === 'fulfilled');
    const rejected = results.filter((result) => result.status === 'rejected');
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0]?.status === 'rejected' ? rejected[0].reason : undefined).toMatchObject({
      code: 'OUT_OF_STOCK',
    });
    expect(inventory.getAvailable('MUG')).toBe(0);
  });

  it('keeps both reservations when they fit together', async () => {
    const inventory = new InventoryService({ MUG: 2 });
    await Promise.all([
      turn(() => inventory.reserve('a', [{ sku: 'MUG', quantity: 1 }])),
      turn(() => inventory.reserve('b', [{ sku: 'MUG', quantity: 1 }])),
    ]);
    expect(inventory.getAvailable('MUG')).toBe(0);
  });
});
