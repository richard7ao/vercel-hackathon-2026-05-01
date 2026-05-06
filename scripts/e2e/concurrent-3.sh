#!/usr/bin/env bash
set -euo pipefail

# T6.5.1 — Three webhooks arrive within 100ms of each other
# Three independent workflows, three independent Hooks.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/_helpers.sh"

SHA_A="conc_a$(date +%s | md5 -q | head -c 12)"
SHA_B="conc_b$(date +%s | md5 -q | head -c 12)"
SHA_C="conc_c$(date +%s | md5 -q | head -c 12)"

cleanup() { cleanup_server; }
trap cleanup EXIT

start_server

# ── 1. Fire three triggers simultaneously ─────────────────────
phase "trigger-3"
curl -s -o /dev/null -X POST "$TARGET_URL/api/demo/trigger" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $DEMO_RESET_TOKEN" \
  --data "{\"sha\":\"$SHA_A\",\"score\":0.9}" &
P1=$!

curl -s -o /dev/null -X POST "$TARGET_URL/api/demo/trigger" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $DEMO_RESET_TOKEN" \
  --data "{\"sha\":\"$SHA_B\",\"score\":0.85}" &
P2=$!

curl -s -o /dev/null -X POST "$TARGET_URL/api/demo/trigger" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $DEMO_RESET_TOKEN" \
  --data "{\"sha\":\"$SHA_C\",\"score\":0.95}" &
P3=$!

wait $P1 $P2 $P3 || true
echo "  three triggers fired"

# ── 2. Wait for all three to pause ────────────────────────────
phase "wait-for-pauses"
FOUND=0
for i in $(seq 1 60); do
  COUNT=0
  for sha in "$SHA_A" "$SHA_B" "$SHA_C"; do
    PAUSE=$(kv_get "pause_state:$sha")
    [ "$PAUSE" != "null" ] && [ -n "$PAUSE" ] && COUNT=$((COUNT + 1))
  done
  if [ "$COUNT" -eq 3 ]; then
    FOUND=1
    echo "  all three paused after ${i}s"
    break
  fi
  sleep 1
done
[ "$FOUND" = "1" ] || fail "not all three paused within 60s (found $COUNT)"

# ── 3. Resume in reverse order (C → B → A) ───────────────────
phase "resume-reverse"
resume_demo "$SHA_C" "ack" "conc-c"
sleep 1
resume_demo "$SHA_B" "ack" "conc-b"
sleep 1
resume_demo "$SHA_A" "ack" "conc-a"

# ── 4. Verify each verdict is independent ─────────────────────
phase "verify-independence"
sleep 3
tsx_run "
import('./lib/db.ts').then(async (m) => {
  const kv = (m.default || m).kv || m.kv;
  const shas = ['$SHA_A', '$SHA_B', '$SHA_C'];
  const users = ['conc-a', 'conc-b', 'conc-c'];
  for (let i = 0; i < shas.length; i++) {
    const v = await kv.get('verdicts:' + shas[i]);
    if (!v) { console.log('FAIL: verdict missing for ' + shas[i]); process.exit(1); }
    if (!v.acknowledged_at) { console.log('FAIL: not acked: ' + shas[i]); process.exit(1); }
    if (v.acknowledged_by !== users[i]) {
      console.log('FAIL: ' + shas[i] + ' acked by ' + v.acknowledged_by + ' (expected ' + users[i] + ')');
      process.exit(1);
    }
    console.log(shas[i] + ': level=' + v.level + ' by=' + v.acknowledged_by);
  }
  process.exit(0);
}).catch(e => { console.error(e); process.exit(1); });
"

phase "result"
echo ""
echo "CONCURRENT-3 PASSED"
echo ""
echo "Verified:"
echo "  - Three simultaneous workflows created"
echo "  - Three independent Hooks"
echo "  - Resumed in reverse order"
echo "  - Each verdict attributed correctly"
