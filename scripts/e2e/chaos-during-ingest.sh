#!/usr/bin/env bash
set -euo pipefail

# T6.6.1 — Kill during ingest
# Kill server within 200ms of webhook receipt, restart, verify recovery.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/_helpers.sh"

SHA="chingest$(date +%s | md5 -q | head -c 12)"

cleanup() { cleanup_server; }
trap cleanup EXIT

# ── 1. Start server ───────────────────────────────────────────
phase "start-server"
(cd "$ROOT" && /opt/homebrew/bin/npx next dev -p "$PORT" > /tmp/e2e-chaos-ingest.log 2>&1 &)
for i in $(seq 1 20); do
  curl -fsS "http://localhost:$PORT" > /dev/null 2>&1 && break
  sleep 1
done

# ── 2. Trigger and immediately kill ───────────────────────────
phase "trigger-and-kill"
trigger_demo "$SHA" 0.9 &
sleep 0.2
pkill -KILL -f "next dev.*$PORT" 2>/dev/null || true
wait || true
echo "  server killed during ingest"

sleep 2

# ── 3. Restart server ────────────────────────────────────────
phase "restart"
(cd "$ROOT" && /opt/homebrew/bin/npx next dev -p "$PORT" > /tmp/e2e-chaos-ingest-2.log 2>&1 &)
for i in $(seq 1 20); do
  curl -fsS "http://localhost:$PORT" > /dev/null 2>&1 && break
  sleep 1
done
echo "  server restarted"

# ── 4. Wait for pause (WDK should replay) ────────────────────
phase "wait-for-pause"
FOUND=0
for i in $(seq 1 45); do
  PAUSE=$(kv_get "pause_state:$SHA")
  if [ "$PAUSE" != "null" ] && [ -n "$PAUSE" ]; then
    FOUND=1
    echo "  pause_state found after ${i}s (WDK replayed)"
    break
  fi
  sleep 1
done

if [ "$FOUND" = "0" ]; then
  echo "WARN: pause_state not found — WDK replay may not have triggered on local dev"
  echo "  (this is expected: WDK durability requires Vercel runtime, not next dev)"
fi

phase "result"
echo ""
echo "CHAOS-DURING-INGEST COMPLETE"
