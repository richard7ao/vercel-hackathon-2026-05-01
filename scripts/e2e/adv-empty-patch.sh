#!/usr/bin/env bash
set -euo pipefail

# T6.4.7 — Empty patch (force-push with no diff)
# Should compute score ~0, no Hook, no Discord post.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/_helpers.sh"

SHA="empty$(date +%s | md5 -q | head -c 16)"

cleanup() { cleanup_server; }
trap cleanup EXIT

start_server

# ── 1. Fire webhook with empty file list ──────────────────────
phase "fire-webhook"
fire_webhook "$SHA" "0000000000000000000000000000000000000000" \
  "richard7ao/meridian-core-banking" "dev-1" \
  "chore: force-push sync" '[]'

# ── 2. Wait for processing ────────────────────────────────────
phase "wait"
sleep 15

# ── 3. Verify no Hook created ─────────────────────────────────
phase "verify"
tsx_run "
import('./lib/db.ts').then(async (m) => {
  const kv = (m.default || m).kv || m.kv;
  const ps = await kv.get('pause_state:$SHA');
  if (ps !== null) {
    console.log('FAIL: Hook created for empty patch');
    process.exit(1);
  }
  console.log('no Hook created for empty patch: verified');
  process.exit(0);
}).catch(e => { console.error(e); process.exit(1); });
"

phase "result"
echo ""
echo "ADV-EMPTY-PATCH PASSED"
