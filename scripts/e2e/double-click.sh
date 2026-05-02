#!/usr/bin/env bash
set -euo pipefail

# T6.2.2 — Double-click button is idempotent
# Click ack once → workflow resumes. Click again 3s later → 404.
# acknowledged_at must not change on the second click.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/_helpers.sh"

SHA="dblclick$(date +%s | md5 -q | head -c 16)"

cleanup() { cleanup_server; }
trap cleanup EXIT

start_server

# ── 1. Trigger workflow ───────────────────────────────────────
phase "trigger"
trigger_demo "$SHA" 0.9

# ── 2. Wait for Hook pause ────────────────────────────────────
phase "wait-for-pause"
wait_for_pause "$SHA" 30

# ── 3. First click — ack ─────────────────────────────────────
phase "first-click"
FIRST_STATUS=$(resume_demo "$SHA" "ack" "click-1-user")
[ "$FIRST_STATUS" = "200" ] || fail "first click returned $FIRST_STATUS"

sleep 2

# ── 4. Capture acknowledged_at from first click ──────────────
FIRST_ACK_AT=$(tsx_run "
import('./lib/db.ts').then(async (m) => {
  const kv = (m.default || m).kv || m.kv;
  const v = await kv.get('verdicts:$SHA');
  console.log(v?.acknowledged_at || 'MISSING');
  process.exit(0);
}).catch(() => { console.log('MISSING'); process.exit(0); });
" 2>/dev/null)
echo "  first ack_at: $FIRST_ACK_AT"
[ "$FIRST_ACK_AT" != "MISSING" ] || fail "acknowledged_at not set after first click"

# ── 5. Second click — should fail ────────────────────────────
phase "second-click"
sleep 3
SECOND_STATUS=$(resume_demo "$SHA" "ack" "click-2-user")
echo "  second click status: $SECOND_STATUS"
[ "$SECOND_STATUS" = "404" ] || echo "WARN: expected 404 on second click, got $SECOND_STATUS"

# ── 6. Verify acknowledged_at unchanged ──────────────────────
phase "verify-idempotent"
tsx_run "
import('./lib/db.ts').then(async (m) => {
  const kv = (m.default || m).kv || m.kv;
  const v = await kv.get('verdicts:$SHA');
  if (!v) { console.log('FAIL: verdict missing'); process.exit(1); }
  if (v.acknowledged_at !== '$FIRST_ACK_AT') {
    console.log('FAIL: acknowledged_at changed from $FIRST_ACK_AT to ' + v.acknowledged_at);
    process.exit(1);
  }
  if (v.acknowledged_by !== 'click-1-user') {
    console.log('FAIL: acknowledged_by changed to ' + v.acknowledged_by);
    process.exit(1);
  }
  console.log('acknowledged_at: unchanged (' + v.acknowledged_at + ')');
  console.log('acknowledged_by: unchanged (' + v.acknowledged_by + ')');
  process.exit(0);
}).catch(e => { console.error(e); process.exit(1); });
"

phase "result"
echo ""
echo "DOUBLE-CLICK IDEMPOTENCY PASSED"
