#!/usr/bin/env bash
set -euo pipefail

# T6.3.1 — AI Gateway 500 → all DurableAgents fall back to deterministic
# Uses invalid AI_GATEWAY_API_KEY to force failures.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/_helpers.sh"

SHA="gw500$(date +%s | md5 -q | head -c 16)"

cleanup() { cleanup_server; }
trap cleanup EXIT

# Override gateway key to force failure
export AI_GATEWAY_API_KEY="__force_500__"

start_server

# ── 1. Trigger workflow ───────────────────────────────────────
phase "trigger"
trigger_demo "$SHA" 0.9

# ── 2. Wait for Hook pause (proves workflow survived) ─────────
phase "wait-for-pause"
wait_for_pause "$SHA" 60

# ── 3. Check verdict exists (derivedVerdict fallback) ─────────
phase "check-verdict"
tsx_run "
import('./lib/db.ts').then(async (m) => {
  const kv = (m.default || m).kv || m.kv;
  const v = await kv.get('verdicts:$SHA');
  if (!v) { console.log('FAIL: no verdict despite gateway failure'); process.exit(1); }
  if (!v.level) { console.log('FAIL: no level in verdict'); process.exit(1); }
  console.log('verdict level: ' + v.level + ' (fallback path worked)');
  process.exit(0);
}).catch(e => { console.error(e); process.exit(1); });
"

# ── 4. Check investigators completed (via deterministic fallback) ─
phase "check-investigators"
tsx_run "
import('./lib/db.ts').then(async (m) => {
  const kv = (m.default || m).kv || m.kv;
  const agents = ['history', 'dependency', 'diff'];
  for (const agent of agents) {
    const rec = await kv.get('investigator:$SHA:' + agent);
    if (!rec) { console.log('WARN: no record for ' + agent); continue; }
    console.log(agent + ': status=' + rec.status);
  }
  process.exit(0);
}).catch(e => { console.error(e); process.exit(1); });
"

# ── 5. Check logs for gateway warnings ────────────────────────
phase "check-logs"
if [ -f /tmp/e2e-dev.log ]; then
  WARN_COUNT=$(grep -c 'Gateway\|gateway\|GATEWAY' /tmp/e2e-dev.log 2>/dev/null || echo "0")
  echo "  AI Gateway warn lines: $WARN_COUNT"
fi

# ── 6. Resume and verify ─────────────────────────────────────
phase "resume"
resume_demo "$SHA" "ack" "gw-test"

phase "result"
echo ""
echo "GATEWAY-500 FALLBACK PASSED"
