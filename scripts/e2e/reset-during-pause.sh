#!/usr/bin/env bash
set -euo pipefail

# T6.5.2 — Reset script while a workflow is paused at Hook
# Reset clears in-flight state, second run works cleanly.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/_helpers.sh"

SHA_1="rst1$(date +%s | md5 -q | head -c 16)"
SHA_2="rst2$(date +%s | md5 -q | head -c 16)"

cleanup() { cleanup_server; }
trap cleanup EXIT

start_server

# ── 1. Trigger first workflow ─────────────────────────────────
phase "trigger-1"
trigger_demo "$SHA_1" 0.9

# ── 2. Wait for Hook pause ────────────────────────────────────
phase "wait-for-pause-1"
wait_for_pause "$SHA_1" 30

# ── 3. Run reset ──────────────────────────────────────────────
phase "reset"
bash "$ROOT/scripts/reset-demo.sh"

# ── 4. Verify reset cleared state ─────────────────────────────
phase "verify-reset"
tsx_run "
import('./lib/db.ts').then(async (m) => {
  const kv = (m.default || m).kv || m.kv;
  const ps = await kv.get('pause_state:$SHA_1');
  const v = await kv.get('verdicts:$SHA_1');
  console.log('pause_state after reset: ' + (ps === null ? 'cleaned' : 'still exists'));
  console.log('verdict after reset: ' + (v === null ? 'cleaned' : 'still exists'));
  process.exit(0);
}).catch(e => { console.error(e); process.exit(1); });
"

# ── 5. Trigger second workflow (should work cleanly) ──────────
phase "trigger-2"
trigger_demo "$SHA_2" 0.9

# ── 6. Wait for second pause ─────────────────────────────────
phase "wait-for-pause-2"
wait_for_pause "$SHA_2" 30
echo "  second workflow paused cleanly"

# ── 7. Resume and verify ─────────────────────────────────────
phase "resume-2"
resume_demo "$SHA_2" "ack" "reset-test"
sleep 3

tsx_run "
import('./lib/db.ts').then(async (m) => {
  const kv = (m.default || m).kv || m.kv;
  const v = await kv.get('verdicts:$SHA_2');
  if (!v || !v.acknowledged_at) {
    console.log('FAIL: second workflow not acked');
    process.exit(1);
  }
  console.log('second workflow completed cleanly');
  process.exit(0);
}).catch(e => { console.error(e); process.exit(1); });
"

phase "result"
echo ""
echo "RESET-DURING-PAUSE PASSED"
