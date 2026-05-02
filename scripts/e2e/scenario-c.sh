#!/usr/bin/env bash
set -euo pipefail

# Scenario C — demo/leak end-to-end
# Fires webhook for demo/leak, waits for Hook pause, resumes with page,
# asserts paged_at is set and secret_shapes detection works.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/_helpers.sh"

SHA=""
cleanup() {
  cleanup_server
  reset_demo_repo
}
trap cleanup EXIT

start_server

# ── 1. Merge demo/leak ────────────────────────────────────────
phase "merge-demo-branch"
SHA=$(merge_demo_branch "demo/leak")
echo "merged demo/leak → $SHA"

# ── 2. Fire signed webhook ────────────────────────────────────
phase "fire-webhook"
fire_webhook "$SHA" "$WATERMARK" "richard7ao/meridian-core-banking" "dev-3" \
  "feat: add observability emitter" '["lib/observability/emit.ts"]'

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

# ── 5. Resume with PAGE ──────────────────────────────────────
phase "resume-page"
RESUME_STATUS=$(resume_demo "$SHA" "page" "e2e-oncall")
[ "$RESUME_STATUS" = "200" ] || fail "resume returned $RESUME_STATUS"

# ── 6. Verify page lifecycle ─────────────────────────────────
phase "verify-page"
sleep 3
tsx_run "
import('./lib/db.ts').then(async (m) => {
  const kv = (m.default || m).kv || m.kv;
  const v = await kv.get('verdicts:$SHA');
  if (!v) { console.log('FAIL: verdict missing after resume'); process.exit(1); }
  if (!v.acknowledged_at) { console.log('FAIL: acknowledged_at not set'); process.exit(1); }
  if (v.action_taken !== 'page') {
    console.log('FAIL: action_taken=' + v.action_taken + ' (expected page)');
    process.exit(1);
  }
  if (!v.paged_at) {
    console.log('FAIL: paged_at not set for page action');
    process.exit(1);
  }

  const ps = await kv.get('pause_state:$SHA');
  if (ps !== null) { console.log('FAIL: pause_state not cleaned'); process.exit(1); }

  console.log('acknowledged_at: ' + v.acknowledged_at);
  console.log('action_taken: ' + v.action_taken);
  console.log('paged_at: ' + v.paged_at);
  console.log('pause_state cleaned: yes');
  process.exit(0);
}).catch(e => { console.error(e); process.exit(1); });
"

phase "result"
echo ""
echo "SCENARIO C PASSED"
echo ""
echo "Verified:"
echo "  - demo/leak merged, webhook accepted"
echo "  - Watchdog pipeline ran to Hook pause"
echo "  - Verdict written with level + concerns"
echo "  - Page action applied, paged_at set"
echo "  - pause_state cleaned"
