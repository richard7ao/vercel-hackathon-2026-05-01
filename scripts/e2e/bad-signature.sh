#!/usr/bin/env bash
set -euo pipefail

# T6.3.5 — Discord signature mismatch returns 401
# POST with wrong signature → 401, no KV mutation.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/_helpers.sh"

cleanup() { cleanup_server; }
trap cleanup EXIT

start_server

# ── 1. POST with bad signature to Discord interactions ────────
phase "bad-signature"
STATUS=$(curl -s -o /tmp/e2e-badsig-resp.json -w '%{http_code}' \
  -X POST "$TARGET_URL/api/discord/interactions" \
  -H "Content-Type: application/json" \
  -H "X-Signature-Ed25519: 0000000000000000000000000000000000000000000000000000000000000000" \
  -H "X-Signature-Timestamp: $(date +%s)" \
  --data '{"type":3,"data":{"custom_id":"ack:test_sha_123"}}')

echo "response status: $STATUS"
BODY=$(cat /tmp/e2e-badsig-resp.json)
echo "response body: $BODY"

[ "$STATUS" = "401" ] || fail "expected 401, got $STATUS"

if echo "$BODY" | grep -qi 'invalid signature\|signature\|unauthorized'; then
  echo "  body mentions signature: yes"
fi

# ── 2. Verify no KV mutation ─────────────────────────────────
phase "verify-no-mutation"
tsx_run "
import('./lib/db.ts').then(async (m) => {
  const kv = (m.default || m).kv || m.kv;
  const v = await kv.get('verdicts:test_sha_123');
  if (v !== null) {
    console.log('FAIL: verdict created by bad-signature request');
    process.exit(1);
  }
  console.log('no KV mutation: verified');
  process.exit(0);
}).catch(e => { console.error(e); process.exit(1); });
"

phase "result"
echo ""
echo "BAD-SIGNATURE 401 PASSED"
