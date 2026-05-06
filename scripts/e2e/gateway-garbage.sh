#!/usr/bin/env bash
set -euo pipefail

# T6.3.2 — AI Gateway returns malformed JSON → fallback used
# Uses BRIDGE_FORCE_LLM_GARBAGE=1 to inject garbage responses.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/_helpers.sh"

SHA="garbage$(date +%s | md5 -q | head -c 16)"

cleanup() { cleanup_server; }
trap cleanup EXIT

export BRIDGE_FORCE_LLM_GARBAGE=1

start_server

# ── 1. Trigger workflow ───────────────────────────────────────
phase "trigger"
trigger_demo "$SHA" 0.9

# ── 2. Wait for Hook pause ────────────────────────────────────
phase "wait-for-pause"
wait_for_pause "$SHA" 60

# ── 3. Verify verdict exists (derivedVerdict fallback) ────────
phase "check-verdict"
tsx_run "
import('./lib/db.ts').then(async (m) => {
  const kv = (m.default || m).kv || m.kv;
  const v = await kv.get('verdicts:$SHA');
  if (!v) { console.log('FAIL: no verdict despite garbage LLM output'); process.exit(1); }
  if (!v.level) { console.log('FAIL: no level'); process.exit(1); }
  console.log('verdict level: ' + v.level + ' (fallback path worked)');
  process.exit(0);
}).catch(e => { console.error(e); process.exit(1); });
"

# ── 4. Resume and clean up ────────────────────────────────────
phase "resume"
resume_demo "$SHA" "ack" "garbage-test"

phase "result"
echo ""
echo "GATEWAY-GARBAGE FALLBACK PASSED"
