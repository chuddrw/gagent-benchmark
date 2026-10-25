import { describe, expect, it } from 'vitest';
import { NotImplementedError, ShopError } from '../src/types.js';

describe('infrastructure smoke', () => {
  it('constructs the shared shop error', () => {
    const error = new ShopError('INVALID_INPUT', 'example');
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(ShopError);
    expect(error.name).toBe('ShopError');
    expect(error.code).toBe('INVALID_INPUT');
    expect(error.message).toBe('example');
  });

  it('exposes the stub sentinel used before product code exists', () => {
    const error = new NotImplementedError();
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(NotImplementedError);
    expect(error.name).toBe('NotImplementedError');
    expect(error.message).toBe('Not implemented');
  });

  it('loads the four public module entry points', async () => {
    const cart = await import('../src/cart.js');
    const discounts = await import('../src/discounts.js');
    const inventory = await import('../src/inventory.js');
    const orders = await import('../src/orders.js');

    expect(cart.CartService).toBeTypeOf('function');
    expect(discounts.applyCoupon).toBeTypeOf('function');
    expect(inventory.InventoryService).toBeTypeOf('function');
    expect(orders.OrderService).toBeTypeOf('function');
  });
});
