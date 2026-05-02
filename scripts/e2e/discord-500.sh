#!/usr/bin/env bash
set -euo pipefail

# T6.3.6 — Discord 5xx on embed post → workflow continues
# Malformed DISCORD_BOT_TOKEN forces postEmbed to fail.
# Workflow should still create Hook and be resumable.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/_helpers.sh"

SHA="disc500$(date +%s | md5 -q | head -c 16)"

cleanup() { cleanup_server; }
trap cleanup EXIT

export DISCORD_BOT_TOKEN="invalid_token_for_test"

start_server

# ── 1. Trigger workflow ───────────────────────────────────────
phase "trigger"
trigger_demo "$SHA" 0.9

# ── 2. Wait for Hook pause (despite Discord failure) ──────────
phase "wait-for-pause"
wait_for_pause "$SHA" 60

echo "  workflow reached Hook despite Discord embed failure"

# ── 3. Verify verdict exists ──────────────────────────────────
phase "check-verdict"
tsx_run "
import('./lib/db.ts').then(async (m) => {
  const kv = (m.default || m).kv || m.kv;
  const v = await kv.get('verdicts:$SHA');
  if (!v) { console.log('FAIL: no verdict'); process.exit(1); }
  console.log('verdict level: ' + v.level);
  process.exit(0);
}).catch(e => { console.error(e); process.exit(1); });
"

# ── 4. Resume via demo endpoint (bypasses Discord) ────────────
phase "resume"
RESUME_STATUS=$(resume_demo "$SHA" "ack" "discord-fail-test")
[ "$RESUME_STATUS" = "200" ] || fail "resume returned $RESUME_STATUS"

# ── 5. Verify ack lifecycle ──────────────────────────────────
phase "verify-ack"
sleep 3
tsx_run "
import('./lib/db.ts').then(async (m) => {
  const kv = (m.default || m).kv || m.kv;
  const v = await kv.get('verdicts:$SHA');
  if (!v) { console.log('FAIL: verdict missing'); process.exit(1); }
  if (!v.acknowledged_at) { console.log('FAIL: acknowledged_at not set'); process.exit(1); }
  console.log('acknowledged: yes');
  process.exit(0);
}).catch(e => { console.error(e); process.exit(1); });
"

# ── 6. Check logs for Discord warning ─────────────────────────
phase "check-logs"
if [ -f /tmp/e2e-dev.log ]; then
  WARN_COUNT=$(grep -c '[Dd]iscord.*fail\|post.*fail' /tmp/e2e-dev.log 2>/dev/null || echo "0")
  echo "  Discord post failure warn lines: $WARN_COUNT"
fi

phase "result"
echo ""
echo "DISCORD-500 WORKFLOW CONTINUES PASSED"
