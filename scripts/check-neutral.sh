#!/usr/bin/env bash
# Fails if company-specific strings reach this public repo.
#
# The patterns are private, so they are NOT stored in the repo. They come from:
#   1. $NEUTRAL_DENYLIST  — newline-separated extended regexes (CI: a repo secret)
#   2. scripts/neutral-denylist.local.txt — same format, gitignored (local runs)
# Lines starting with # and blank lines are ignored. Matching is case-insensitive.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

local_list=scripts/neutral-denylist.local.txt
if [ -n "${NEUTRAL_DENYLIST:-}" ]; then
  patterns=$(printf '%s\n' "$NEUTRAL_DENYLIST")
elif [ -f "$local_list" ]; then
  patterns=$(cat "$local_list")
else
  echo "check-neutral: no pattern list (set NEUTRAL_DENYLIST or create $local_list) — skipped" >&2
  exit 0
fi
patterns=$(printf '%s\n' "$patterns" | grep -vE '^[[:space:]]*(#|$)' || true)
[ -n "$patterns" ] || { echo "check-neutral: pattern list is empty — skipped" >&2; exit 0; }

hits=$(git ls-files -z | xargs -0 grep -nIiE -f <(printf '%s\n' "$patterns") || true)
if [ -n "$hits" ]; then
  echo "Company-specific strings found:" >&2
  echo "$hits" >&2
  exit 1
fi
echo "check-neutral: clean"
