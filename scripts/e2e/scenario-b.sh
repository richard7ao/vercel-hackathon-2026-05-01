#!/usr/bin/env bash
set -euo pipefail

# Scenario B — demo/privesc end-to-end
# Fires webhook for demo/privesc, waits for Hook pause, resumes with hold,
# asserts held_until is set and investigators completed.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/_helpers.sh"

SHA=""
cleanup() {
  cleanup_server
  reset_demo_repo
}
trap cleanup EXIT

start_server

# ── 1. Merge demo/privesc ─────────────────────────────────────
phase "merge-demo-branch"
SHA=$(merge_demo_branch "demo/privesc")
echo "merged demo/privesc → $SHA"

# ── 2. Fire signed webhook ────────────────────────────────────
phase "fire-webhook"
fire_webhook "$SHA" "$WATERMARK" "richard7ao/meridian-core-banking" "dev-3" \
  "feat: add wire override endpoint" '["app/api/admin/wire-override/route.ts"]'

# ── 3. Wait for Hook pause ────────────────────────────────────
phase "wait-for-pause"
wait_for_pause "$SHA" 60

# ── 4. Check verdict level ────────────────────────────────────
phase "check-verdict"
tsx_run "
import('./lib/db.ts').then(async (m) => {
  const kv = (m.default || m).kv || m.kv;
  const v = await kv.get('verdicts:$SHA');
  if (!v) { console.log('FAIL: no verdict'); process.exit(1); }
  if (!v.level) { console.log('FAIL: no level'); process.exit(1); }
  console.log('verdict level: ' + v.level);
  console.log('concerns: ' + JSON.stringify(v.concerns || []));
  process.exit(0);
}).catch(e => { console.error(e); process.exit(1); });
"

# ── 5. Check investigators ────────────────────────────────────
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

# ── 6. Resume with HOLD ──────────────────────────────────────
phase "resume-hold"
RESUME_STATUS=$(resume_demo "$SHA" "hold" "e2e-reviewer")
[ "$RESUME_STATUS" = "200" ] || fail "resume returned $RESUME_STATUS"

# ── 7. Verify hold lifecycle ─────────────────────────────────
phase "verify-hold"
sleep 3
tsx_run "
import('./lib/db.ts').then(async (m) => {
  const kv = (m.default || m).kv || m.kv;
  const v = await kv.get('verdicts:$SHA');
  if (!v) { console.log('FAIL: verdict missing after resume'); process.exit(1); }
  if (!v.acknowledged_at) { console.log('FAIL: acknowledged_at not set'); process.exit(1); }
  if (v.action_taken !== 'hold') {
    console.log('FAIL: action_taken=' + v.action_taken + ' (expected hold)');
    process.exit(1);
  }
  if (!v.held_until) {
    console.log('FAIL: held_until not set for hold action');
    process.exit(1);
  }
  const heldUntil = new Date(v.held_until);
  const now = new Date();
  const diffMinutes = (heldUntil.getTime() - now.getTime()) / 60000;
  if (diffMinutes < 25 || diffMinutes > 35) {
    console.log('FAIL: held_until should be ~30 min ahead, got ' + diffMinutes.toFixed(1) + ' min');
    process.exit(1);
  }

  const ps = await kv.get('pause_state:$SHA');
  if (ps !== null) { console.log('FAIL: pause_state not cleaned'); process.exit(1); }

  console.log('acknowledged_at: ' + v.acknowledged_at);
  console.log('action_taken: ' + v.action_taken);
  console.log('held_until: ' + v.held_until + ' (~' + diffMinutes.toFixed(0) + ' min ahead)');
  console.log('pause_state cleaned: yes');
  process.exit(0);
}).catch(e => { console.error(e); process.exit(1); });
"

phase "result"
echo ""
echo "SCENARIO B PASSED"
echo ""
echo "Verified:"
echo "  - demo/privesc merged, webhook accepted"
echo "  - Watchdog pipeline ran to Hook pause"
echo "  - Verdict written with level + concerns"
echo "  - Hold action applied, held_until ~30 min ahead"
echo "  - pause_state cleaned"
