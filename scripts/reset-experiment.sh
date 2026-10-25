#!/usr/bin/env bash
# Add a detached worktree at the benchmark-start tag.
# Does not modify the current branch, working tree, or remote.
# Refuses to replace an existing destination.

set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "Usage: scripts/reset-experiment.sh <new-worktree-directory>" >&2
  exit 2
fi

root=$(cd "$(dirname "$0")/.." && pwd)
dest=$1

if [[ -e "$dest" ]]; then
  echo "Destination already exists; refusing to overwrite: $dest" >&2
  exit 1
fi

if ! git -C "$root" rev-parse --verify --quiet refs/tags/benchmark-start >/dev/null; then
  echo "Tag benchmark-start does not exist. Run scripts/create-benchmark-start.sh first." >&2
  exit 1
fi

git -C "$root" worktree add --detach "$dest" benchmark-start
echo "Detached worktree at $dest on benchmark-start."
echo "Do not check out another branch in this worktree."
echo "Coordinator branches contain the hidden acceptance suite."
