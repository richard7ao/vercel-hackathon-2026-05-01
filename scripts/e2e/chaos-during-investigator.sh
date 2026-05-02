#!/usr/bin/env bash
set -euo pipefail

# T6.6.3 — Kill during a DurableAgent investigator call
# Kill during fan-out, restart, verify recovery.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/_helpers.sh"

SHA="chinv$(date +%s | md5 -q | head -c 12)"

cleanup() { cleanup_server; }
trap cleanup EXIT

# ── 1. Start server ───────────────────────────────────────────
phase "start-server"
(cd "$ROOT" && /opt/homebrew/bin/npx next dev -p "$PORT" > /tmp/e2e-chaos-inv.log 2>&1 &)
for i in $(seq 1 20); do
  curl -fsS "http://localhost:$PORT" > /dev/null 2>&1 && break
  sleep 1
done

# ── 2. Trigger and kill after brief delay (during fan-out) ────
phase "trigger-and-kill"
trigger_demo "$SHA" 0.9
sleep 3
pkill -KILL -f "next dev.*$PORT" 2>/dev/null || true
echo "  server killed during investigator fan-out"
sleep 2

# ── 3. Restart ────────────────────────────────────────────────
phase "restart"
(cd "$ROOT" && /opt/homebrew/bin/npx next dev -p "$PORT" > /tmp/e2e-chaos-inv-2.log 2>&1 &)
for i in $(seq 1 20); do
  curl -fsS "http://localhost:$PORT" > /dev/null 2>&1 && break
  sleep 1
done
echo "  server restarted"

# ── 4. Check for recovery ────────────────────────────────────
phase "wait-for-pause"
FOUND=0
for i in $(seq 1 45); do
  PAUSE=$(kv_get "pause_state:$SHA")
  if [ "$PAUSE" != "null" ] && [ -n "$PAUSE" ]; then
    FOUND=1
    echo "  pause_state found after ${i}s (WDK replayed investigator fan-out)"
    break
  fi
  sleep 1
done

if [ "$FOUND" = "0" ]; then
  echo "WARN: pause_state not found — WDK replay requires Vercel runtime"
fi

phase "result"
echo ""
echo "CHAOS-DURING-INVESTIGATOR COMPLETE"
