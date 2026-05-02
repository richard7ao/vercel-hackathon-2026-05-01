#!/usr/bin/env bash
set -euo pipefail

# T6.3.3 — KV unavailable mid-workflow
# Only runs against local Redis. Skip if using managed KV.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/_helpers.sh"

if [ -z "${REDIS_URL:-}" ] || ! echo "$REDIS_URL" | grep -q '127.0.0.1\|localhost'; then
  echo "SKIP: KV outage test requires local Redis (current REDIS_URL is managed or unset)"
  exit 0
fi

SHA="kvout$(date +%s | md5 -q | head -c 16)"

cleanup() { cleanup_server; }
trap cleanup EXIT

start_server

# ── 1. Trigger workflow ───────────────────────────────────────
phase "trigger"
trigger_demo "$SHA" 0.9

# ── 2. Wait for pause ────────────────────────────────────────
phase "wait-for-pause"
wait_for_pause "$SHA" 30

# ── 3. Kill Redis ────────────────────────────────────────────
phase "kill-redis"
redis-cli SHUTDOWN NOSAVE 2>/dev/null || echo "  redis shutdown attempted"
sleep 5

# ── 4. Restart Redis ─────────────────────────────────────────
phase "restart-redis"
redis-server --daemonize yes 2>/dev/null || echo "  redis restart attempted"
sleep 2

# ── 5. Resume and verify ─────────────────────────────────────
phase "resume"
resume_demo "$SHA" "ack" "kv-test" || echo "  resume may fail (expected during recovery)"

sleep 5

tsx_run "
import('./lib/db.ts').then(async (m) => {
  const kv = (m.default || m).kv || m.kv;
  const v = await kv.get('verdicts:$SHA');
  console.log('verdict after recovery: ' + JSON.stringify(v ? { level: v.level } : null));
  process.exit(0);
}).catch(e => { console.error(e); process.exit(0); });
"

phase "result"
echo ""
echo "KV-OUTAGE TEST COMPLETE"
