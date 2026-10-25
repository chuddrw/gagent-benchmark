# MiniShop benchmark specification

Build a deterministic, in-memory MiniShop order service with four areas: cart, discounts, inventory, and checkout/orders. Represent all money as integer cents; quantities and stock counts are nonnegative integers, with requested purchase quantities strictly positive. Dates, time zones, payment providers, persistence, and network services are out of scope. Expose an end-to-end CLI demo calling the public APIs to purchase products.

1. **Cart:** Accept a catalog of `{sku, priceCents}` products and cart entries `{sku, quantity}`. Reject duplicate catalog SKUs, unknown SKU, invalid quantity and invalid price. A cart can contain multiple SKUs, and repeated add-to-cart requests for a SKU accumulate quantity. Compute deterministic line totals and subtotal without floating-point currency arithmetic. Empty cart cannot checkout.
2. **Discounts:** Implement percent-off coupon codes with a `{code, percent, minSubtotalCents, maxDiscountCents?}` definition. Codes are case-insensitive, at most one coupon per checkout, min spend checked against pre-discount subtotal, and percentage calculation uses `Math.floor(subtotalCents * percent / 100)` capped by `maxDiscountCents` if present. Reject unknown/ineligible codes. Final order total cannot be negative.
3. **Inventory:** Track available stock by SKU in memory. Reserve an entire list of requested items atomically: if *any* SKU cannot be reserved, no stock changes. No overselling, including simultaneous calls in a single Node process; reserve exactly once per successful order. Provide an idempotent reservation keyed by order ID, so a repeated checkout with the same ID cannot decrement stock twice.
4. **Orders:** Accept checkout input `{orderId, items, couponCode?}`, validate cart, price and coupon eligibility, then atomically reserve stock before returning a confirmed order `{orderId, items, subtotalCents, discountCents, totalCents, status:'confirmed'}`. If validation or stock reservation fails, do not create a successful order or alter inventory. A repeat with the same orderId and identical request returns the original confirmed order without reserving twice; a repeat with different data raises an error. Expose `getOrder(orderId)`. The cart, coupon, inventory, and order modules must interoperate through the shared public interfaces.
5. **Quality:** Build succeeds with `npm run typecheck`; tests pass with `npm test`; no hidden network calls. Errors must be structured (e.g. `{code, message}`), not silent success. Demonstrate success, coupon use, out-of-stock failure, and idempotent retry in `src/demo.ts` runnable with `npm run demo`.

## Public contracts
Predefine `src/types.ts` with the following **types**, and supply signatures in the four module stubs; teams are free to choose internal implementation details. Keeping a minimal stable external contract makes tests possible while leaving genuine integration work. If the product is intended to coordinate evolving interfaces, you may run a separate variant that leaves internal module interface decisions open, but use the same variant across A/B/C.

```ts
export type CatalogItem = { sku: string; priceCents: number };
export type CartItem = { sku: string; quantity: number };
export type CartTotals = { items: Array<CartItem & { priceCents: number; lineTotalCents: number }>; subtotalCents: number };
export type Coupon = { code: string; percent: number; minSubtotalCents: number; maxDiscountCents?: number };
export type DiscountResult = { discountCents: number; totalCents: number };
export type CheckoutRequest = { orderId: string; items: CartItem[]; couponCode?: string };
export type Order = { orderId: string; items: CartItem[]; subtotalCents: number; discountCents: number; totalCents: number; status: 'confirmed' };
export type ShopErrorCode = 'INVALID_INPUT' | 'UNKNOWN_SKU' | 'UNKNOWN_COUPON' | 'INELIGIBLE_COUPON' | 'OUT_OF_STOCK' | 'ORDER_ID_CONFLICT' | 'EMPTY_CART';
```

Suggested public functions/classes (actual starter `src/*.ts` stubs must establish exact signatures):
- `new CartService(catalog: CatalogItem[])`, `.add(sku, qty)`, `.totals(): CartTotals`.
- `applyCoupon(subtotalCents: number, couponCode: string | undefined, coupons: Coupon[]): DiscountResult`.
- `new InventoryService(initial: Record<string, number>)`, `.reserve(orderId: string, items: CartItem[]): void`, `.getAvailable(sku: string): number`.
- `new OrderService(cartCatalog: CatalogItem[], coupons: Coupon[], inventory: InventoryService)`, `.checkout(req: CheckoutRequest): Order`, `.getOrder(orderId: string): Order | undefined`.

Use `ShopError extends Error` with `code: ShopErrorCode` for shared errors. For idempotence, compare normalized checkout inputs (same SKUs/quantities even if item ordering differs), not the raw object identity. Whether a coupon omitted or undefined is equivalent should be explicit in acceptance tests.
