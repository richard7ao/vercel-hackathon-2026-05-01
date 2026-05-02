#!/usr/bin/env bash
set -euo pipefail

# T6.2.3 — resumeHook for nonexistent token returns 404
# No workflow running — resume should fail cleanly.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/_helpers.sh"

cleanup() { cleanup_server; }
trap cleanup EXIT

start_server

# ── 1. Resume a nonexistent deploy ────────────────────────────
phase "resume-nonexistent"
STATUS=$(curl -s -o /tmp/e2e-nonexist-resp.json -w '%{http_code}' \
  -X POST "$TARGET_URL/api/demo/resume" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $DEMO_RESET_TOKEN" \
  --data '{"deploy_id":"nonexistent_sha_abc123","action_type":"ack","username":"test"}')

echo "response status: $STATUS"
cat /tmp/e2e-nonexist-resp.json

if [ "$STATUS" != "404" ]; then
  fail "expected 404 for nonexistent deploy, got $STATUS"
fi

BODY=$(cat /tmp/e2e-nonexist-resp.json)
if ! echo "$BODY" | grep -qi 'not found'; then
  echo "WARN: body doesn't contain 'not found': $BODY"
fi

# ── 2. Verify no KV mutation ─────────────────────────────────
phase "verify-no-mutation"
tsx_run "
import('./lib/db.ts').then(async (m) => {
  const kv = (m.default || m).kv || m.kv;
  const v = await kv.get('verdicts:nonexistent_sha_abc123');
  if (v !== null) {
    console.log('FAIL: verdict created for nonexistent deploy');
    process.exit(1);
  }
  const ps = await kv.get('pause_state:nonexistent_sha_abc123');
  if (ps !== null) {
    console.log('FAIL: pause_state created for nonexistent deploy');
    process.exit(1);
  }
  console.log('no KV mutation: verified');
  process.exit(0);
}).catch(e => { console.error(e); process.exit(1); });
"

phase "result"
echo ""
echo "RESUME-NONEXISTENT PASSED"
