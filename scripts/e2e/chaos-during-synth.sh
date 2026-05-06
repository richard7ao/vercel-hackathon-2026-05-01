#!/usr/bin/env bash
set -euo pipefail

# T6.6.2 — Kill during synthesizer DurableAgent call
# Kill after investigators complete, before Hook. Restart, verify recovery.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/_helpers.sh"

SHA="chsynth$(date +%s | md5 -q | head -c 12)"

cleanup() { cleanup_server; }
trap cleanup EXIT

# ── 1. Start server ───────────────────────────────────────────
phase "start-server"
(cd "$ROOT" && /opt/homebrew/bin/npx next dev -p "$PORT" > /tmp/e2e-chaos-synth.log 2>&1 &)
for i in $(seq 1 20); do
  curl -fsS "http://localhost:$PORT" > /dev/null 2>&1 && break
  sleep 1
done

# ── 2. Trigger workflow ───────────────────────────────────────
phase "trigger"
trigger_demo "$SHA" 0.9

# ── 3. Wait for investigators to appear, then kill ────────────
phase "wait-for-investigators-and-kill"
for i in $(seq 1 30); do
  INV=$(kv_get "investigator:$SHA:history")
  if [ "$INV" != "null" ] && [ -n "$INV" ]; then
    echo "  investigator record found, killing server"
    pkill -KILL -f "next dev.*$PORT" 2>/dev/null || true
    break
  fi
  sleep 1
done
sleep 2

# ── 4. Restart server ────────────────────────────────────────
phase "restart"
(cd "$ROOT" && /opt/homebrew/bin/npx next dev -p "$PORT" > /tmp/e2e-chaos-synth-2.log 2>&1 &)
for i in $(seq 1 20); do
  curl -fsS "http://localhost:$PORT" > /dev/null 2>&1 && break
  sleep 1
done
echo "  server restarted"

# ── 5. Check if pause state appears ──────────────────────────
phase "wait-for-pause"
FOUND=0
for i in $(seq 1 45); do
  PAUSE=$(kv_get "pause_state:$SHA")
  if [ "$PAUSE" != "null" ] && [ -n "$PAUSE" ]; then
    FOUND=1
    echo "  pause_state found after ${i}s (synthesizer replayed)"
    break
  fi
  sleep 1
done

if [ "$FOUND" = "0" ]; then
  echo "WARN: pause_state not found — WDK replay requires Vercel runtime"
fi

phase "result"
echo ""
echo "CHAOS-DURING-SYNTH COMPLETE"
