#!/usr/bin/env bash
# Tier 4 — CLAUDE.md canonical server lifecycle (start → wait → assert → cleanup).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
LOG=/tmp/bridge-tier4-verify.log
rm -f "$LOG"
( npx next dev -p 3030 >"$LOG" 2>&1 & )
cleanup() {
  pkill -f 'next dev.*3030' 2>/dev/null || true
}
trap cleanup EXIT
for i in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15; do
  if curl -fsS http://localhost:3030 >/dev/null 2>&1; then
    break
  fi
  sleep 1
done
if ! curl -fsS http://localhost:3030 | grep -q "BRIDGE"; then
  echo "Tier4 FAIL: home page missing BRIDGE (see $LOG)" >&2
  tail -30 "$LOG" >&2 || true
  exit 1
fi
echo "Tier4 PASS: next dev on 3030 serves war room"
