# Gagent benchmark: one task, three collaboration modes

## Research question
Does Gagent reduce **human intervention time** and **time to a correct integrated result** compared with a single agent and four agents coordinating through GitHub alone?

Modes:
- `solo`: One engineer operates one coding agent on one machine.
- `github`: Four engineers each operate one agent on separate machines. They coordinate through GitHub branches, PR comments, issues, and ordinary GitHub CI. No Gagent messages, shared-intent feed, or agent-triggered repairs.
- `gagent`: The same four engineers, machines, agents, and task divisions as `github`, plus Gagent shared intentions, continuous WIP integration, conflict assignment, negotiated repair (if implemented), and verification.

**Don't rig the comparison:** Give every mode the *same* complete project specification and final acceptance tests. The solo agent receives the whole project; four-agent modes receive the same specification split into four feature tickets. It is legitimate that solo and multi-agent work differently; keep hardware/model/token budget, starting repository, and success criteria documented. Four-agent modes must use identical tickets and starting code. Use the same amount of human access across modes.

## Test project: MiniShop checkout (TypeScript)

The starter repository contains `src/cart.ts`, `src/discounts.ts`, `src/inventory.ts`, `src/orders.ts`, shared `src/types.ts`, and a CLI demo at `src/demo.ts`. There is no web UI. Normative behavior is `SPEC.md`, including its Frozen rulings. Where this overview is shorter, `SPEC.md` wins.

### Functional specification, identical in all modes
1. **Cart**: `priceCents` is an integer number of cents; calculate line totals and subtotal from quantity. Purchase quantities are strictly positive. `SPEC.md` has the full validation rules.
2. **Discounts**: percent discount is an integer `0..100`, applied to the pre-discount subtotal in integer cents with the rounding rule in `SPEC.md`. This benchmark has no shipping charge.
3. **Inventory**: check and reserve integer quantities; insufficient stock returns a structured error; do not decrement stock for a failed order.
4. **Orders**: create an order only after validating cart, discounts, and stock; record the agreed total, reserve stock exactly once, and return an order id and total in cents. The only stored status is `confirmed`.
5. **Shared contract**: All interfaces use `priceCents`, integer quantities, typed errors, and the documented rounding rule. Do not change the public acceptance criteria without recording explicit human approval.

### Feature tickets (identical for modes github and gagent)
- A: Cart, totals, input validation.
- B: Discounts, rounding, promotional logic.
- C: Inventory availability, reservation, rollback behavior.
- D: Checkout orchestration, order status, and integration flow.

Give all modes the above entire spec; do **not** manufacture conflicting requirements or assign secretly inconsistent currency units. Expected coordination emerges from the natural coupling of discounts, carts, inventory, and orders.

### Independent holdout acceptance tests
Implement tests *before* beginning each run, in a benchmark-owned suite that agents cannot edit. Useful cases:
- Cart with two line items has exact integer-cent subtotal.
- 15% discount on 999 cents follows the published rounding rule.
- Failed checkout leaves inventory unchanged.
- Two concurrent requests cannot reserve more than available inventory (if concurrency is part of the spec).
- Successful checkout decrements stock exactly once and produces matching order total.
- Unknown SKU, invalid quantity, and invalid discount return documented errors.
- Full checkout passes a cross-module integration test.

Tests must be equally available and/or withheld for all modes. Run private holdout tests only as evaluation, not to secretly guide Gagent.

## Run protocol

### Before each trial
1. Reset each machine/repository to the same tagged starter commit (`benchmark-start`).
2. Reset GitHub PR/issue state and Gagent state. Use unique trial branches/repository clones so previous snapshots do not leak.
3. Record model/provider/version, agent harness/version, reasoning settings, machine specs, agent token limits, PR and CI configuration, and the exact prompt/tickets.
4. Select a time budget (e.g., 45 minutes) and start when the task prompt is handed to the agent(s).
5. Designate one human intervention recorder. Record active human minutes, not just number of messages.

### A — Solo
- One agent with full specification builds the project on one machine.
- Engineer may intervene under the same policy as other arms, and logs interventions.
- Run identical project tests and independently controlled holdout checks.

### B — GitHub-only team
- Four agents on four computers, each assigned its feature ticket.
- Coordination through GitHub issues, PRs, PR comments, branches, and normal CI only.
- Humans may coordinate or resolve failures, with every intervention logged.
- No Gagent hooks, WIP aggregator, automated cross-agent failure routing, or shared-intent messages.

### C — Gagent team
- Same four tickets, four machines, models, prompts, and GitHub access as B.
- Turn on Gagent hooks and shared intentions; auto-snapshot to dedicated `wip/<agent>` branches.
- Watcher evaluates current combined work in an isolated worktree and reports integration failures.
- Route conflicts to agents; if implemented, require a shared resolution/contract before repairs. Record all automated repair attempts.
- The final artifact still passes the **same** acceptance suite as A and B.

### Completion rule
Stop timing on the first **integrated**, reproducible, successfully checked-out artifact passing the full *independent* acceptance suite. A green TypeScript run alone is not completion. A partial result at time limit is a failure/censored trial (record completed features and failing tests). Do not exclude unsuccessful trials from averages.

### Intervention policy
Count any human action that changes project direction, supplies a missing technical decision, mediates between agents, debugs integration, resolves merge failures, or edits implementation. Do not count initial task handoff or passive watching. Record both human-event count and actual active minutes. Distinguish 'approval' from 'debug/coordination'. Record agent inference cost/tokens and machine wall-time as secondary trade-offs.

## Instrumentation
Use `bench.py start` to initialize a trial and `bench.py event` to log interventions, conflicts, repair attempts, tests, and completion. `bench.py report` generates mode summaries; `bench.py evaluate` runs an evaluator command, records the exit code, and saves logs. All modes use the same evaluator command and cannot modify holdout tests.

Example:
```bash
python bench.py start --mode github --trial github-01 --out results
python bench.py event --trial github-01 --out results --type human_intervention --duration-sec 240 --note 'Developer resolved conflicting order totals'
python bench.py event --trial github-01 --out results --type repair_attempt --note 'Changed shared order total calculation'
python bench.py evaluate --trial github-01 --out results --command 'bash scripts/evaluate-candidate.sh /path/to/candidate'
python bench.py finish --trial github-01 --out results --success
python bench.py report --out results
```

`npm test` runs the public smoke test and any unit tests the agents added. It is not the success criterion. Score the candidate with `scripts/evaluate-candidate.sh`, which runs typecheck, `npm test`, the hidden acceptance suite, and the demo without modifying the candidate checkout. **Do not declare success using only tests written by the agents.**

The time-budget examples in this file (45 minutes) and in `SETUP_AND_PROMPTS.md` (60 minutes) are suggestions. Pick one budget and use it for every mode.

## Replication and reporting
- Minimum demo: one trial per mode; describe as an illustration, **not** a statistically meaningful speedup claim.
- Stronger evidence: 5+ trials per mode; rotate run order and use the same sequence of task variants/seeds across modes. Report medians and per-trial outcomes, including failures and timeouts.
- Primary: active human intervention minutes to successful completion, and human intervention events.
- Secondary: wall-clock completion time, holdout pass fraction, repair loops, total agent tokens/cost, CI runs, human approvals.
- Measure both *total time* and *human time*. Four remote agents may cost more than one; don't imply cost or efficiency savings unless measured.
- If Gagent changes agent autonomy or prompting beyond the coordination system, clearly disclose it as a confound.

## Demo video sequence (60–90 seconds of benchmark evidence)
1. Show the same MiniShop feature list and acceptance criteria for all three setups.
2. Show four independently progressing agents in GitHub-only mode; reveal one real combined failure and the manual coordination required to resolve it. Don't invent the failure if it didn't occur.
3. Replay the analogous Gagent run: live WIP checks turn red, conflict notification and explanation arrive, the agent(s) settle the fix, then watcher turns green. Only show features that really worked in that run.
4. Show the final measured A/B/C table, include denominators and whether numbers are single runs or medians.
5. State the narrowly supported conclusion: 'In this benchmark, Gagent reduced X versus standard GitHub coordination while meeting the same acceptance criteria' **only if the measurements prove it**.

## Suggested controlled stress case (supplement, not primary performance proof)
To demonstrate the mechanism deterministically, use an explicitly labeled diagnostic scenario: A changes an API to emit milliseconds, B consumes seconds, both isolated unit tests pass but a holdout integration test catches the mismatch. This is a useful live feature demonstration but **not** evidence of typical performance; keep it separate from natural-task benchmark trials.

## Questions the team must freeze
- Is Gagent currently just detection + fixer assignment, or does it enforce multi-agent consent to a shared resolution? Do not narrate consensus unless implemented.
- Which exact event triggers a Claude Code reawakening, and does it work for an idle but running session?
- Which tests are user-visible versus hidden holdouts, and who maintains them?
- Who logs human interventions? Ideally a neutral recorder using the same definitions in every mode.

## Starter commands

Trials use Node.js 22 or newer. From this coordinator checkout:

```bash
npm install
npm run typecheck
npm test
npm run test:acceptance
npm run demo
```

`npm run typecheck` and `npm test` pass on the starter. `npm test` is only an infrastructure smoke test. `npm run test:acceptance` and `npm run demo` fail until the product behavior in `SPEC.md` is implemented. Those failures should be missing behavior, reported as `NotImplementedError: Not implemented`, not import or configuration errors.

| Command | What it runs | Starter result |
| --- | --- | --- |
| `npm run typecheck` | `tsc --noEmit` for `src/`, public tests, and the holdout suite | Pass |
| `npm test` | Vitest files in `test/` and `src/**/*.test.ts` | Pass |
| `npm run test:acceptance` | Vitest files in `evaluator/acceptance/` | Fail |
| `npm run demo` | Compiles `src/` and runs the CLI | Fail |

Agents may add unit tests under `test/` or as `src/**/*.test.ts`. Those run with `npm test`. They are not the acceptance suite.

The modules `src/cart.ts`, `src/discounts.ts`, `src/inventory.ts`, `src/orders.ts`, and `src/demo.ts` throw `NotImplementedError` on purpose. Do not fill in MiniShop while preparing a trial.

## Hidden acceptance tests

`evaluator/acceptance/` is owned by the person running the benchmark. It is the same suite for solo, GitHub, and Gagent. Agents must not read or edit it. `scripts/create-benchmark-start.sh` leaves that directory, `vitest.acceptance.config.ts`, `bench.py`, `prompts/`, and `scripts/` out of the tagged starter so a trial checkout cannot see the cases.

`scripts/evaluate-candidate.sh <candidate-checkout>` copies this repository to a temporary directory, overlays the candidate's `src/` and `test/`, and runs `npm ci`, typecheck, public tests, acceptance tests, and the demo. It does not modify the candidate or the coordinator working tree.

## `benchmark-start`

Create the frozen starter tag once, after `npm install` has produced `package-lock.json`. The script writes an orphan commit and an annotated tag. It does not move `HEAD`, change the current branch, or edit the working tree. If the tag already exists, the script stops.

```bash
bash scripts/create-benchmark-start.sh
```

Give every trial a checkout of that tag only. Do not give agents this coordinator branch; its history and tree contain the holdout tests.

```bash
bash scripts/reset-experiment.sh ../trials/solo-01
```

That adds a detached git worktree at `benchmark-start` and refuses to replace an existing directory. To publish a trial remote that has no other branches:

```bash
git push <trial-remote> benchmark-start:refs/heads/main
```

Do not force-push. Do not retag `benchmark-start` after a trial has started. Deleting the tag is a manual decision and is not part of the script.

Inside a trial worktree, `npm ci`, `npm run typecheck`, and `npm test` are the starter sanity checks. Run `npm run test:acceptance` from this coordinator checkout, or run `scripts/evaluate-candidate.sh` against the worktree, to confirm the unimplemented starter fails the holdout suite.
