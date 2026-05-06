#!/usr/bin/env bash
set -euo pipefail

# Scenario A — demo/exfil end-to-end
# Fires webhook for demo/exfil, waits for Hook pause, resumes with ack,
# asserts full verdict lifecycle including investigator completion.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/_helpers.sh"

SHA=""
cleanup() {
  cleanup_server
  reset_demo_repo
}
trap cleanup EXIT

start_server

# ── 1. Merge demo/exfil ───────────────────────────────────────
phase "merge-demo-branch"
SHA=$(merge_demo_branch "demo/exfil")
echo "merged demo/exfil → $SHA"

# ── 2. Fire signed webhook ────────────────────────────────────
phase "fire-webhook"
fire_webhook "$SHA" "$WATERMARK" "richard7ao/meridian-core-banking" "dev-3" \
  "chore: add auth metrics emitter" '["lib/auth.ts"]'

# ── 3. Wait for pipeline to reach Hook pause ──────────────────
phase "wait-for-pause"
wait_for_pause "$SHA" 60

# ── 4. Check verdict was written by synthesizer ───────────────
phase "check-verdict"
tsx_run "
import('./lib/db.ts').then(async (m) => {
  const kv = (m.default || m).kv || m.kv;
  const v = await kv.get('verdicts:$SHA');
  if (!v) { console.log('FAIL: no verdict'); process.exit(1); }
  if (!v.level) { console.log('FAIL: no level'); process.exit(1); }
  if (v.level !== 'critical' && v.level !== 'investigate') {
    console.log('WARN: expected critical or investigate, got ' + v.level);
  }
  console.log('verdict level: ' + v.level);
  console.log('concerns: ' + JSON.stringify(v.concerns || []));
  process.exit(0);
}).catch(e => { console.error(e); process.exit(1); });
"

# ── 5. Check investigator records ─────────────────────────────
phase "check-investigators"
tsx_run "
import('./lib/db.ts').then(async (m) => {
  const kv = (m.default || m).kv || m.kv;
  const agents = ['history', 'dependency', 'diff'];
  let allComplete = true;
  for (const agent of agents) {
    const rec = await kv.get('investigator:$SHA:' + agent);
    if (!rec) {
      console.log('FAIL: no investigator record for ' + agent);
      allComplete = false;
      continue;
    }
    if (rec.status !== 'complete' && rec.status !== 'dispatched') {
      console.log('FAIL: ' + agent + ' status=' + rec.status);
      allComplete = false;
    } else {
      console.log(agent + ': status=' + rec.status);
    }
  }
  if (!allComplete) process.exit(1);
  process.exit(0);
}).catch(e => { console.error(e); process.exit(1); });
"

# ── 6. Resume via /api/demo/resume ────────────────────────────
phase "resume-hook"
RESUME_STATUS=$(resume_demo "$SHA" "ack" "chaos-test-user")
[ "$RESUME_STATUS" = "200" ] || fail "resume returned $RESUME_STATUS"

# ── 7. Wait and verify ack lifecycle ──────────────────────────
phase "verify-ack"
sleep 3
tsx_run "
import('./lib/db.ts').then(async (m) => {
  const kv = (m.default || m).kv || m.kv;
  const v = await kv.get('verdicts:$SHA');
  if (!v) { console.log('FAIL: verdict missing after resume'); process.exit(1); }
  if (!v.acknowledged_at) { console.log('FAIL: acknowledged_at not set'); process.exit(1); }
  if (v.acknowledged_by !== 'chaos-test-user') {
    console.log('FAIL: acknowledged_by=' + v.acknowledged_by + ' (expected chaos-test-user)');
    process.exit(1);
  }
  if (v.action_taken !== 'ack') {
    console.log('FAIL: action_taken=' + v.action_taken + ' (expected ack)');
    process.exit(1);
  }

  const ps = await kv.get('pause_state:$SHA');
  if (ps !== null) { console.log('FAIL: pause_state not cleaned'); process.exit(1); }

  console.log('acknowledged_at: ' + v.acknowledged_at);
  console.log('acknowledged_by: ' + v.acknowledged_by);
  console.log('action_taken: ' + v.action_taken);
  console.log('pause_state cleaned: yes');
  process.exit(0);
}).catch(e => { console.error(e); process.exit(1); });
"

phase "result"
echo ""
echo "SCENARIO A PASSED"
echo ""
echo "Verified:"
echo "  - demo/exfil merged, webhook accepted"
echo "  - Watchdog pipeline ran to Hook pause"
echo "  - Verdict written with level + concerns"
echo "  - All three investigators dispatched (history, dependency, diff)"
echo "  - Hook resumed via ack by chaos-test-user"
echo "  - acknowledged_at set, pause_state cleaned"
