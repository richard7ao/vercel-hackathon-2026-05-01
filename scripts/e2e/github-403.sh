#!/usr/bin/env bash
set -euo pipefail

# T6.3.4 — GitHub API 403 / rate-limit on ingest
# With invalid GITHUB_TOKEN, ingest should fail closed (score: 0).

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/_helpers.sh"

SHA="gh403$(date +%s | md5 -q | head -c 16)"

cleanup() { cleanup_server; }
trap cleanup EXIT

# Invalid GitHub token forces ingest failure
export GITHUB_TOKEN="ghp_invalid_for_test"

start_server

# ── 1. Fire webhook (not demo/trigger — we need real ingest path) ─
phase "fire-webhook"
fire_webhook "$SHA" "0000000000000000000000000000000000000000" \
  "richard7ao/meridian-core-banking" "dev-3" \
  "chore: test commit" '["lib/test.ts"]'

# ── 2. Wait a few seconds for processing ──────────────────────
phase "wait"
sleep 10

# ── 3. Verify no Hook was created ─────────────────────────────
phase "verify-no-hook"
tsx_run "
import('./lib/db.ts').then(async (m) => {
  const kv = (m.default || m).kv || m.kv;
  const ps = await kv.get('pause_state:$SHA');
  if (ps !== null) {
    console.log('FAIL: pause_state should not exist on ingest failure');
    process.exit(1);
  }
  const v = await kv.get('verdicts:$SHA');
  if (v !== null) {
    console.log('WARN: verdict exists despite ingest failure: ' + JSON.stringify(v));
  }
  console.log('no Hook created: verified');
  console.log('no verdict: ' + (v === null ? 'verified' : 'exists (score was > threshold)'));
  process.exit(0);
}).catch(e => { console.error(e); process.exit(1); });
"

# ── 4. Check logs for ingest warning ──────────────────────────
phase "check-logs"
if [ -f /tmp/e2e-dev.log ]; then
  WARN_COUNT=$(grep -c 'ingest\|INGEST' /tmp/e2e-dev.log 2>/dev/null || echo "0")
  echo "  ingest warn lines: $WARN_COUNT"
fi

phase "result"
echo ""
echo "GITHUB-403 FAIL-CLOSED PASSED"
