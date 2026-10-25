#!/usr/bin/env bash
# Create an orphan commit and the annotated tag `benchmark-start`.
# The tagged tree contains only the agent-visible starter. It omits the
# holdout suite, operator scripts, prompts, and bench.py.
# This does not move HEAD, switch branches, edit the worktree, or replace an
# existing tag.

set -euo pipefail

root=$(cd "$(dirname "$0")/.." && pwd)
cd "$root"

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "Run this inside the gagent_benchmark git repository." >&2
  exit 1
fi

if git rev-parse --verify --quiet refs/tags/benchmark-start >/dev/null; then
  echo "Tag benchmark-start already exists at $(git rev-parse --short benchmark-start)." >&2
  echo "Refusing to move it. Trials must keep this tag stable." >&2
  exit 1
fi

required=(
  package.json
  package-lock.json
  tsconfig.json
  tsconfig.demo.json
  vitest.config.ts
  .gitignore
  SPEC.md
  README.md
  src/types.ts
  src/cart.ts
  src/discounts.ts
  src/inventory.ts
  src/orders.ts
  src/demo.ts
  test/smoke.test.ts
)

for file in "${required[@]}"; do
  if [[ ! -f "$root/$file" ]]; then
    echo "Missing $file." >&2
    echo "Run npm install so package-lock.json exists, then retry." >&2
    exit 1
  fi
done

tmp=$(mktemp -d "${TMPDIR:-/tmp}/minishop-start.XXXXXX")
cleanup() {
  rm -rf "$tmp"
}
trap cleanup EXIT

node --input-type=module -e '
import fs from "node:fs";
const [src, dest] = process.argv.slice(1);
const data = JSON.parse(fs.readFileSync(src, "utf8"));
delete data.scripts["test:acceptance"];
fs.writeFileSync(dest, JSON.stringify(data, null, 2) + "\n");
' "$root/package.json" "$tmp/package.json"

export GIT_INDEX_FILE="$tmp/index"
git read-tree --empty

add_file() {
  local blob
  blob=$(git hash-object -w "$1")
  git update-index --add --cacheinfo "100644,$blob,$2"
}

add_file "$tmp/package.json" "package.json"
for file in "${required[@]}"; do
  if [[ "$file" == "package.json" ]]; then
    continue
  fi
  add_file "$root/$file" "$file"
done

tree=$(git write-tree)
commit=$(git commit-tree "$tree" -m "Start MiniShop from unimplemented stubs.")
git tag -a benchmark-start "$commit" -m "Frozen MiniShop starter for solo, GitHub, and Gagent trials."

echo "Created tag benchmark-start"
echo "Commit: $commit"
echo "Tree:   $tree"
echo "HEAD was not moved and the working tree was not changed."
echo "The tagged tree omits evaluator/, prompts/, scripts/, and bench.py."
echo "Push only this history to a trial remote, for example:"
echo "  git push <trial-remote> benchmark-start:refs/heads/main"
