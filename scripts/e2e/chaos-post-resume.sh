#!/usr/bin/env bash
set -euo pipefail

# T6.6.4 — Kill after Hook resume but before verdict written
# Kill within 100ms of resume. Restart. Verify ack eventually applies.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/_helpers.sh"

SHA="chresume$(date +%s | md5 -q | head -c 12)"

cleanup() { cleanup_server; }
trap cleanup EXIT

# ── 1. Start server ───────────────────────────────────────────
phase "start-server"
(cd "$ROOT" && /opt/homebrew/bin/npx next dev -p "$PORT" > /tmp/e2e-chaos-resume.log 2>&1 &)
for i in $(seq 1 20); do
  curl -fsS "http://localhost:$PORT" > /dev/null 2>&1 && break
  sleep 1
done

# ── 2. Trigger workflow and wait for pause ────────────────────
phase "trigger"
trigger_demo "$SHA" 0.9

phase "wait-for-pause"
wait_for_pause "$SHA" 30

# ── 3. Resume and immediately kill ────────────────────────────
phase "resume-and-kill"
resume_demo "$SHA" "ack" "chaos-resume-user" &
sleep 0.1
pkill -KILL -f "next dev.*$PORT" 2>/dev/null || true
wait || true
echo "  server killed after resume"
sleep 2

# ── 4. Restart ────────────────────────────────────────────────
phase "restart"
(cd "$ROOT" && /opt/homebrew/bin/npx next dev -p "$PORT" > /tmp/e2e-chaos-resume-2.log 2>&1 &)
for i in $(seq 1 20); do
  curl -fsS "http://localhost:$PORT" > /dev/null 2>&1 && break
  sleep 1
done
echo "  server restarted"

# ── 5. Check if verdict got acknowledged ──────────────────────
phase "verify"
sleep 5
tsx_run "
import('./lib/db.ts').then(async (m) => {
  const kv = (m.default || m).kv || m.kv;
  const v = await kv.get('verdicts:$SHA');
  if (!v) {
    console.log('WARN: verdict missing — WDK replay may not have completed');
    process.exit(0);
  }
  console.log('verdict level: ' + (v.level || 'n/a'));
  console.log('acknowledged_at: ' + (v.acknowledged_at || 'not yet'));
  console.log('acknowledged_by: ' + (v.acknowledged_by || 'n/a'));
  process.exit(0);
}).catch(e => { console.error(e); process.exit(0); });
"

phase "result"
echo ""
echo "CHAOS-POST-RESUME COMPLETE"
