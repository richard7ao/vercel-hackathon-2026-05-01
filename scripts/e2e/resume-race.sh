#!/usr/bin/env bash
set -euo pipefail

# T6.2.4 — Two near-simultaneous resume calls (race)
# Fire two ack POSTs in parallel. Exactly one should succeed.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/_helpers.sh"

SHA="race$(date +%s | md5 -q | head -c 16)"

cleanup() { cleanup_server; }
trap cleanup EXIT

start_server

# ── 1. Trigger workflow ───────────────────────────────────────
phase "trigger"
trigger_demo "$SHA" 0.9

# ── 2. Wait for Hook pause ────────────────────────────────────
phase "wait-for-pause"
wait_for_pause "$SHA" 30

# ── 3. Fire two resume calls in parallel ──────────────────────
phase "parallel-resume"
curl -s -o /tmp/e2e-race-1.json -w '%{http_code}\n' \
  -X POST "$TARGET_URL/api/demo/resume" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $DEMO_RESET_TOKEN" \
  --data "{\"deploy_id\":\"$SHA\",\"action_type\":\"ack\",\"username\":\"racer-1\"}" > /tmp/e2e-race-status-1 &
PID1=$!

curl -s -o /tmp/e2e-race-2.json -w '%{http_code}\n' \
  -X POST "$TARGET_URL/api/demo/resume" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $DEMO_RESET_TOKEN" \
  --data "{\"deploy_id\":\"$SHA\",\"action_type\":\"ack\",\"username\":\"racer-2\"}" > /tmp/e2e-race-status-2 &
PID2=$!

wait $PID1 || true
wait $PID2 || true

S1=$(cat /tmp/e2e-race-status-1)
S2=$(cat /tmp/e2e-race-status-2)
echo "  racer-1 status: $S1"
echo "  racer-2 status: $S2"

# ── 4. Verify exactly one succeeded ──────────────────────────
phase "verify-race"
SUCCESSES=0
[ "$S1" = "200" ] && SUCCESSES=$((SUCCESSES + 1))
[ "$S2" = "200" ] && SUCCESSES=$((SUCCESSES + 1))

echo "  successes: $SUCCESSES"
if [ "$SUCCESSES" -eq 0 ]; then
  fail "both resume calls failed"
fi

sleep 2

# ── 5. Verify single acknowledged_at ─────────────────────────
tsx_run "
import('./lib/db.ts').then(async (m) => {
  const kv = (m.default || m).kv || m.kv;
  const v = await kv.get('verdicts:$SHA');
  if (!v) { console.log('FAIL: verdict missing'); process.exit(1); }
  if (!v.acknowledged_at) { console.log('FAIL: acknowledged_at not set'); process.exit(1); }
  console.log('acknowledged_by: ' + v.acknowledged_by);
  console.log('acknowledged_at: ' + v.acknowledged_at);
  process.exit(0);
}).catch(e => { console.error(e); process.exit(1); });
"

phase "result"
echo ""
echo "RESUME-RACE PASSED"
