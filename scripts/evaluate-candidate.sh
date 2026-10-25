#!/usr/bin/env bash
# Score a candidate checkout with the frozen toolchain and holdout suite.
# Copies this coordinator repository to a temporary directory, overlays the
# candidate src/ and test/ trees, then runs the evaluator commands.
# Does not modify the candidate or the coordinator working tree.

set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "Usage: scripts/evaluate-candidate.sh <candidate-checkout>" >&2
  exit 2
fi

root=$(cd "$(dirname "$0")/.." && pwd)
candidate=$(cd "$1" && pwd)
work=$(mktemp -d "${TMPDIR:-/tmp}/minishop-eval.XXXXXX")
cleanup() {
  rm -rf "$work"
}
trap cleanup EXIT

if [[ ! -d "$candidate/src" ]]; then
  echo "Candidate has no src directory: $candidate" >&2
  exit 2
fi

rsync -a \
  --exclude '.git' \
  --exclude 'node_modules' \
  --exclude 'results' \
  "$root/" "$work/"
rsync -a --delete "$candidate/src/" "$work/src/"
if [[ -d "$candidate/test" ]]; then
  mkdir -p "$work/test"
  rsync -a "$candidate/test/" "$work/test/"
fi

cd "$work"
echo "Evaluating $candidate"

set +e
npm ci
ci=$?
npm run typecheck
tc=$?
npm test
unit=$?
npm run test:acceptance
acc=$?
npm run demo
demo=$?
set -e

echo "npm_ci=$ci typecheck=$tc npm_test=$unit acceptance=$acc demo=$demo"
exit $((ci || tc || unit || acc || demo))
