# Benchmark metrics and how to use the tests

Read this if you are the agent conducting or scoring a MiniShop trial. Implementing agents receive `SPEC.md` and one prompt from `prompts/`. They do not receive this file, and they do not receive `evaluator/acceptance/`.

The comparison has three modes. Each mode starts from the same `benchmark-start` tag, the same spec, and the same holdout suite.

| Mode | `bench.py` value | Setup |
| --- | --- | --- |
| Solo | `solo` | One agent, one machine, `prompts/solo.md`. No subagents and no Gagent. |
| GitHub | `github` | Four agents, four machines, `prompts/agent-a.md` through `prompts/agent-d.md`. Coordination is GitHub only. |
| Gagent | `gagent` | The same four prompts, machines, and tickets as GitHub, plus Gagent. |

Agent A owns `src/cart.ts`. Agent B owns `src/discounts.ts`. Agent C owns `src/inventory.ts`. Agent D owns `src/orders.ts`, `src/demo.ts`, and checkout integration. The solo agent owns all of those files.

## What a passing trial means

A trial succeeds at the first integrated checkout that passes the evaluator command below. Record that moment with `bench.py finish --success`.

These outcomes do not end the trial:

- `npm run typecheck` passes.
- `npm test` passes.
- An agent says the work is finished.
- One module's own tests pass.
- A Gagent watcher reports green.

`npm test` runs `test/smoke.test.ts` and any `*.test.ts` files the agents added under `test/` or `src/`. Those tests help the agents develop. The score is the holdout suite plus the demo, run by the evaluator from the coordinator checkout.

## Commands

Run the product checks from a trial checkout created at `benchmark-start`:

```bash
npm ci
npm run typecheck
npm test
npm run demo
```

On the untouched starter, typecheck and `npm test` pass. `npm run demo` fails with `NotImplementedError: Not implemented` until `src/demo.ts` calls the public APIs and shows a successful purchase, a coupon purchase, an out-of-stock failure, and an idempotent retry.

Score a candidate only from the coordinator checkout, which still contains the holdout suite:

```bash
bash scripts/evaluate-candidate.sh /absolute/path/to/candidate
```

The script copies the coordinator tree to a temporary directory, overlays the candidate's `src/` and `test/`, and runs `npm ci`, `npm run typecheck`, `npm test`, `npm run test:acceptance`, and `npm run demo`. It does not modify the candidate or the coordinator working tree. The process exits 0 only when every one of those commands exits 0. Its last line reports each exit code:

```text
npm_ci=0 typecheck=0 npm_test=0 acceptance=0 demo=0
```

`npm run test:acceptance` runs `evaluator/acceptance/**/*.test.ts`. The cases check observable shop behavior from `SPEC.md` and its Frozen rulings: cart totals, coupon eligibility and rounding, atomic and idempotent stock reservation, checkout, replay, invalid input, and cross-module orders. They compare error `code` values, not message text. A correct implementation passes them. The starter fails them with `NotImplementedError`.

Use that same evaluator command for solo, GitHub, and Gagent. Log it:

```bash
python bench.py evaluate --trial <trial-id> --out results \
  --command 'bash scripts/evaluate-candidate.sh /absolute/path/to/candidate'
```

`bench.py evaluate` stores the exit code and the combined output. Exit 0 means the candidate passed the full evaluator script.

If agents are still working, leave the trial running after a failed evaluation. The clock stops only for a reproducible pass or for the shared time limit.

## Metrics

`python bench.py report --out results` writes `results/report.csv`. One row is one trial. Keep failed and timed-out trials in the averages. One trial per mode is a demonstration. A performance claim needs at least five trials per mode, with medians and the failed trials included.

### Primary

**Human minutes (`human_min`).** This is the research question: how many active minutes a person spends to reach a passing integrated result. `bench.py` adds `duration-sec` from events whose type is `human_intervention` and converts the sum to minutes.

Log only active help:

```bash
python bench.py event --trial <trial-id> --out results \
  --type human_intervention --duration-sec 240 \
  --note 'Resolved a merge conflict in order totals'
```

Count a human action that changes direction, answers a technical question the agents could not resolve, mediates between agents, debugs integration, fixes a merge, or edits code. The initial prompt and passive watching stay off this metric. The same counting rule applies to all three modes.

**Human events (`human_events`).** This is how many of those interventions occurred. A few long interventions and many short ones can have the same total minutes, so the count shows whether Gagent removed interruptions or only shortened them.

### Secondary

**Elapsed minutes (`elapsed_min`).** Wall-clock time from `bench.py start` to `bench.py finish`. Start the trial immediately before the prompt is delivered. For four-agent modes, deliver all four prompts as close together as you can and record the last dispatch time in the start notes. This metric shows calendar time. It is not human effort. Four machines can finish sooner while consuming more human attention or more model spend.

**Status (`status`).** `success`, `timeout`, or `failed`, taken from `bench.py finish`. `success` is valid only after the evaluator command exits 0 on the integrated tree. `timeout` means the shared time budget ended first. Use the same budget for every mode. `failed` means the work stopped without a passing integrated result and without hitting the timeout rule you chose.

**Last evaluation passed (`last_eval_pass`).** True when the latest `bench.py evaluate` command exited 0. Earlier failures remain in `events.jsonl`. Read this flag together with `status`: a passing evaluation that has not been followed by `finish --success` is not yet a closed successful trial.

**Conflicts (`conflicts`).** Number of `--type conflict` events. Log a real disagreement or an integration break that required coordination, such as two modules computing a different total. This separates "the agents discovered a mismatch" from "a person spent time fixing it."

**Repair attempts (`repair_attempts`).** Number of `--type repair_attempt` events. Log each attempt to fix a conflict or a failed integration, including a Gagent-triggered repair. The count is the repair loop. A repair attempt is not itself a success.

**Approvals.** Log a human go-ahead that does not debug or edit with `--type approval`. Approvals stay in `results/<trial>/events.jsonl`. The CSV does not sum them. Keeping them separate prevents a merge approval from looking like debugging time.

**Agent tokens and cost.** `bench.py` does not read model invoices. Record provider, model, and spend in `bench.py start --notes` or in `--type note` events. Compare cost only when every mode used the same prices and the same measurement. Four agents can spend more than one agent even when wall-clock time is shorter.

**CI runs.** Count GitHub CI runs from GitHub, then store the count in a note. The CSV does not query GitHub.

### How to read a comparison

The primary claim is about human minutes and human events to a holdout pass. Elapsed minutes answer a different question: how long the clock ran. Tokens and cost answer a third question: what the run spent. Report the denominator, whether each number is a single trial or a median, and include timeouts. State a Gagent improvement only when these measurements show it under the same spec, tests, model, and time limit.

If Gagent changed the prompt, the model, or the agent's autonomy beyond coordination, record that in the trial notes. That difference is a confound, not a coordination result.

## Running one trial

Create the tag once from the coordinator checkout, after `npm install`:

```bash
bash scripts/create-benchmark-start.sh
```

The tag is an orphan snapshot. It contains the stubs, `SPEC.md`, the smoke test, and the npm scripts. It omits `evaluator/`, `prompts/`, `scripts/`, `bench.py`, and this file. Do not move the tag after the first scored trial.

For each trial:

```bash
bash scripts/reset-experiment.sh ../trials/<trial-id>
python bench.py start --mode <solo|github|gagent> --trial <trial-id> --out results \
  --notes 'model, agent version, time budget, last prompt dispatch'
```

Give the solo agent `prompts/solo.md`. Give each GitHub or Gagent agent only its own file in `prompts/`. In the trial worktree, the sanity checks are `npm ci`, `npm run typecheck`, and `npm test`.

When the integrated tree is ready, or at the time limit:

```bash
python bench.py evaluate --trial <trial-id> --out results \
  --command 'bash scripts/evaluate-candidate.sh /absolute/path/to/candidate'
python bench.py finish --trial <trial-id> --out results --success
```

Use `--timeout` or `--failed` instead of `--success` when the evaluator command did not exit 0. Then:

```bash
python bench.py report --out results
```

Raw events for a trial are `results/<trial-id>/trial.json` and `results/<trial-id>/events.jsonl`. Evaluation logs are `results/<trial-id>/eval-*.log`.

## Rules that keep the three modes comparable

- Start every trial at the same `benchmark-start` commit, with a new agent session and no reused solution.
- Use one time budget, one model configuration, and one holdout suite.
- The four-agent prompts stay byte-identical between GitHub and Gagent. Gagent adds coordination machinery only.
- Implementing agents may write unit tests. They may not read or edit `evaluator/acceptance/`.
- Do not fill in MiniShop in the starter. The stubs throw `NotImplementedError` so the trial measures the later agents.
- Do not mark success from tests the implementing agents wrote.
