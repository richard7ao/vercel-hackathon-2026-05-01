#!/usr/bin/env bash
set -euo pipefail

# T6.2.1 — Hook timeout fires cleanly
# Triggers a workflow, does NOT click any button, waits for timeout.
# WDK_PAUSE_MAX_SECONDS should be set low (e.g. 20) by the caller.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/_helpers.sh"

TIMEOUT_S="${WDK_PAUSE_MAX_SECONDS:-20}"
SHA="timeout$(date +%s | md5 -q | head -c 16)"

cleanup() { cleanup_server; }
trap cleanup EXIT

start_server

# ── 1. Trigger workflow with forced high score ────────────────
phase "trigger"
trigger_demo "$SHA" 0.9

# ── 2. Wait for Hook pause ────────────────────────────────────
phase "wait-for-pause"
wait_for_pause "$SHA" 30

# ── 3. Do NOT resume — wait for timeout ──────────────────────
phase "wait-for-timeout"
echo "  waiting ${TIMEOUT_S}s + 10s buffer for timeout..."
sleep $((TIMEOUT_S + 10))

# ── 4. Verify timeout state ──────────────────────────────────
phase "verify-timeout"
tsx_run "
import('./lib/db.ts').then(async (m) => {
  const kv = (m.default || m).kv || m.kv;
  const v = await kv.get('verdicts:$SHA');
  if (!v) { console.log('FAIL: verdict missing after timeout'); process.exit(1); }
  if (v.acknowledged_at) {
    console.log('FAIL: acknowledged_at should be null on timeout, got ' + v.acknowledged_at);
    process.exit(1);
  }

  const ps = await kv.get('pause_state:$SHA');
  console.log('verdict level: ' + (v.level || 'n/a'));
  console.log('acknowledged_at: ' + (v.acknowledged_at || 'null (correct)'));
  console.log('pause_state: ' + (ps ? 'still exists (WDK may still hold)' : 'cleaned'));
  process.exit(0);
}).catch(e => { console.error(e); process.exit(1); });
"

phase "result"
echo ""
echo "HOOK TIMEOUT PASSED"
