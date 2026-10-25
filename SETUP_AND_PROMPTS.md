# Gagent benchmark — exact setup and prompts

## Objective
Compare (A) one developer/agent on one computer; (B) four developers/agents on four computers collaborating with GitHub; (C) the same four people, agents, computers, and tickets with Gagent coordination. Primary endpoint: active human intervention minutes to a passing integrated application. Secondary endpoints: wall-clock completion time, human intervention count, success/acceptance coverage, agent tokens/cost, repair loops.

## Freeze these before starting
- **Project:** MiniShop Checkout, a Node.js 22 + TypeScript strict-mode **backend library plus a minimal CLI demo**. No external database, payment service, auth, browser UI, or network dependency. Use Vitest. Do not change the tech stack between conditions.
- **Starting repository:** One tagged Git commit `benchmark-start` containing package.json/lockfile, tsconfig.json, vitest config, `src/types.ts` with public types and interfaces below, `src/cart.ts`, `src/discounts.ts`, `src/inventory.ts`, `src/orders.ts` exporting typed function signatures that throw `NotImplementedError` with the message `Not implemented`, `src/demo.ts` placeholder, and a README with the same specification. Starter code is **identical** in all conditions. Do not provide one condition extra implementation code.
- **Acceptance:** An evaluator-controlled, read-only test suite, developed and verified before trials and not visible to agents. Use a separate repo/worktree. Same assertions for all conditions. Agents may write their own unit tests; the hidden suite is used only to score finished candidate. Provide public behavioral specification, not hidden test code.
- **Resources:** Same model, model configuration, agent CLI version, repo base, prompts, tool access (apart from Gagent), and time limit (recommended 60 minutes) in each run. In B/C use four separate machines and one agent per machine; no additional invisible agents. In A use just one agent (no subagents). Fix a max spend per agent and disclose aggregate spend.
- **Human assistance:** Same rule for all three: humans may answer clarifying questions, coordinate, and manually fix issues, but every active intervention is timed and logged. Initial prompt and environment setup do not count. No human may edit the benchmark's acceptance tests.
- **Condition isolation:** Use a clean branch or clone per run, independent new agent sessions, cleared Gagent state/inboxes, and unique GitHub branches/repo if necessary. No code or solutions from a previous trial may be reused. To reduce learning effects, rotate condition order between repeats, or use separate operators with matched experience.
- **Fairness:** B and C share **exactly the same task tickets** and common spec. C differs only in Gagent hooks, coordination, watcher, agent-to-agent messaging and automatic repair. Do not instruct B's agents to avoid communicating or resolving conflicts through GitHub. Avoid injecting contrived contradictory requirements.

## Shared task specification

`SPEC.md` is the agent-facing copy of this brief, including the Frozen rulings. Keep that file intact. The text below is the original brief for reference.

Build a deterministic, in-memory MiniShop order service with four areas: cart, discounts, inventory, and checkout/orders. Represent all money as integer cents; quantities and stock counts are nonnegative integers, with requested purchase quantities strictly positive. Dates, time zones, payment providers, persistence, and network services are out of scope. Expose an end-to-end CLI demo calling the public APIs to purchase products.

1. **Cart:** Accept a catalog of `{sku, priceCents}` products and cart entries `{sku, quantity}`. Reject duplicate catalog SKUs, unknown SKU, invalid quantity and invalid price. A cart can contain multiple SKUs, and repeated add-to-cart requests for a SKU accumulate quantity. Compute deterministic line totals and subtotal without floating-point currency arithmetic. Empty cart cannot checkout.
2. **Discounts:** Implement percent-off coupon codes with a `{code, percent, minSubtotalCents, maxDiscountCents?}` definition. Codes are case-insensitive, at most one coupon per checkout, min spend checked against pre-discount subtotal, and percentage calculation uses `Math.floor(subtotalCents * percent / 100)` capped by `maxDiscountCents` if present. Reject unknown/ineligible codes. Final order total cannot be negative.
3. **Inventory:** Track available stock by SKU in memory. Reserve an entire list of requested items atomically: if *any* SKU cannot be reserved, no stock changes. No overselling, including simultaneous calls in a single Node process; reserve exactly once per successful order. Provide an idempotent reservation keyed by order ID, so a repeated checkout with the same ID cannot decrement stock twice.
4. **Orders:** Accept checkout input `{orderId, items, couponCode?}`, validate cart, price and coupon eligibility, then atomically reserve stock before returning a confirmed order `{orderId, items, subtotalCents, discountCents, totalCents, status:'confirmed'}`. If validation or stock reservation fails, do not create a successful order or alter inventory. A repeat with the same orderId and identical request returns the original confirmed order without reserving twice; a repeat with different data raises an error. Expose `getOrder(orderId)`. The cart, coupon, inventory, and order modules must interoperate through the shared public interfaces.
5. **Quality:** Build succeeds with `npm run typecheck`; tests pass with `npm test`; no hidden network calls. Errors must be structured (e.g. `{code, message}`), not silent success. Demonstrate success, coupon use, out-of-stock failure, and idempotent retry in `src/demo.ts` runnable with `npm run demo`.

### Public contracts — DO NOT alter during a trial without recording a human design change
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

The normative copy of this brief is `SPEC.md`. Its "Frozen rulings" section is also normative for every condition. Those rulings are the acceptance-test decisions the brief originally left open. Do not give one condition a different reading.

## Exact common instruction (append to EVERY agent prompt)

> Use only the repository and tools allowed in your assigned scenario. Follow SPEC.md and the existing public types. You may write unit tests. Do not modify benchmark-owned evaluator tests. Ask humans only when needed; humans record all active assistance. Communicate naturally using the channels allowed for this scenario. Do not assume another agent's uncommitted work has landed. Signal when your assigned work is finished, including any remaining integration risks. Do not misrepresent unrun tests as passing.

## Scenario A — exact solo prompt

> You are the **only coding agent** on MiniShop. Starting from the `benchmark-start` commit, implement the complete SPEC.md: cart and pricing, coupons, inventory reservation/idempotence, order checkout, and runnable demo. You own all implementation files and must integrate and test the entire application. Do not spawn subagents or ask another coding agent to perform tasks. You may ask your human operator questions under the common assistance policy. Deliver code that passes `npm run typecheck`, `npm test`, and `npm run demo`; identify any outstanding limitations.
>
> [Append the exact common instruction above.]

**Run setup:** One developer, one computer, one fresh agent session; disable Gagent and any shared-agent service. Ordinary git commits are allowed but there are no other development agents.

## Scenarios B and C — identical agent prompts

Each agent receives SPEC.md plus **only its ticket below**, then the common instruction. Do not give different task wording in B and C. Agents can see the public contract and full high-level spec but own their individual module work.

### Agent A: Cart and catalog
> You own `src/cart.ts` and cart-focused tests. Implement catalog validation, cart item accumulation, quantity validation, line totals, and subtotal according to SPEC.md and `src/types.ts`. Coordinate any cross-module interface issue with the relevant teammate using the coordination channels enabled in this scenario. Do not independently rewrite other agents' modules. When finished, share usage assumptions needed by checkout.

### Agent B: Coupons
> You own `src/discounts.ts` and coupon-focused tests. Implement coupon lookup, eligibility, percentage rounding, capped discounts, and invalid coupon errors according to SPEC.md and `src/types.ts`. Coordinate any cross-module interface issue with the relevant teammate using the coordination channels enabled in this scenario. Do not independently rewrite other agents' modules. When finished, share assumptions needed by checkout.

### Agent C: Inventory
> You own `src/inventory.ts` and inventory-focused tests. Implement stock validation, all-or-nothing reservation, order-ID idempotence, and stock queries according to SPEC.md and `src/types.ts`. Coordinate any cross-module interface issue with the relevant teammate using the coordination channels enabled in this scenario. Do not independently rewrite other agents' modules. When finished, share assumptions needed by checkout.

### Agent D: Orders + CLI integration
> You own `src/orders.ts`, `src/demo.ts`, and checkout-focused tests. Implement full checkout orchestration, error propagation, order storage, same-order-ID request idempotence, and the runnable demo according to SPEC.md and `src/types.ts`. Integrate with the other three public modules. Coordinate interface assumptions and integration failures with those agents using the channels enabled in this scenario. Do not independently rewrite their modules. Deliver an end-to-end runnable checkout flow.

**B setup:** Four developer laptops, four fresh Claude Code sessions (one per laptop), four branches (e.g. `feature/cart`, `feature/coupons`, `feature/inventory`, `feature/orders`), GitHub issues/PRs/comments and standard CI. Agents and operators may communicate through GitHub and ask for help under the common policy. No Gagent tool calls, hooks or auto-WIP watcher. A human integrates PRs unless the normal GitHub workflow already allows safe agent merges; record actions.

**C setup:** Identical four laptops, sessions, branches, ownership tickets, CI and prompts; enable Gagent MCP/tools and hooks. Snapshots go to dedicated `wip/<agent>` refs; the cloud watcher tests temporary combined snapshots, reports failures, shares intentions and sends repair requests. Agents may automatically negotiate and repair through Gagent if those capabilities actually exist. Do not claim automated negotiation if the deployed build only assigns one fixer. Keep normal GitHub integration as the final deliverable. Record Gagent manual setup separately as overhead.

## Test execution steps for each condition
1. Recreate clean checkout of `benchmark-start`, install dependencies with `npm ci`, run starter sanity checks, and ensure initial acceptance tests fail as expected on unimplemented functions.
2. Start the timer **immediately before giving the prompt(s)**. For 4-agent modes, dispatch all four prompts as close to simultaneously as feasible; record the actual last dispatch time.
3. Allow work to proceed, recording every **human intervention** with start/end time and reason. Also log GitHub comments, merge attempts, Gagent conflicts, successful/failed repairs and test runs where possible.
4. When agents report completion, integrate all code into an evaluator branch/worktree. Run `npm ci`, `npm run typecheck`, `npm test`, and the **independent holdout tests**. If tests fail, continue the clock; agents/developers may repair under the same intervention policy. All trials have the same timeout.
5. Stop the timer at the **first reproducible fully passing integrated result** (not at first agent completion or first Git push). Record passes, misses, total cost/tokens, and individual intervention durations. If timeout, record failure and incomplete tests.
6. Run at least 5 trials per condition for any performance claim; one trial per condition is a demo illustration, not evidence of a stable percentage improvement.

## Integration test plan (implement separately before starting)
- Two SKUs: 3 units at 1999 cents and 2 units at 250 cents => subtotal 6497 cents.
- Coupon 15% with minimum 5000 and cap 750 cents => discount 750, total 5747.
- Subtotal 999 and 15% coupon without cap => discount `Math.floor(149.85)` = 149 cents.
- Coupon is case-insensitive; unknown and below-minimum codes throw typed errors.
- Add same SKU twice, verify quantity aggregation and total.
- Stock insufficient for one line in a multi-SKU order => all quantities unchanged.
- Successful checkout reserves quantities exactly once and stores an order.
- Same order ID, identical request returns stored result and does not reserve twice.
- Same order ID, modified request fails and does not change stock.
- Failed coupon validation does not decrement inventory or store order.
- Negative/zero/fractional quantity, bad price and unknown SKU throw typed errors.
- Multi-module end-to-end checkout from public constructors completes correctly.
- If you include concurrent calls, specify the single-process concurrency model and test it consistently; do not imply distributed transactional guarantees.

## Preflight and evaluation checklist
- [ ] `SPEC.md`, TypeScript stubs, npm scripts, and holdout suite are frozen.
- [ ] Four prompts are byte-identical between B and C.
- [ ] All teams start from same baseline commit and identical dependencies.
- [ ] No contaminated agent memory/conversation from earlier trials.
- [ ] B has fair access to normal GitHub coordination, not artificially restricted.
- [ ] End condition uses independent evaluator tests, not Gagent's own green check.
- [ ] Measured outcome highlights both human intervention time and overall completion time.

## Specific risk to disclose
The stable shared external types may make inter-agent coordination too easy to expose Gagent's advantage. Run this first as the **controlled baseline**. For a second, more dependency-heavy workload, change the benchmark starter to leave some *internal* contracts unspecified while retaining clear external requirements and independent tests. Apply that variation equally to A, B and C and report it as a distinct benchmark; never alter only B's requirements to make conflicts more frequent.
