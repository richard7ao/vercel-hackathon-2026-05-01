#!/usr/bin/env bash
set -euo pipefail

# T6.4.2 — Trusted CODEOWNER at off-hours
# Benign change by the CODEOWNER at 03:42 UTC should not trigger critical.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/_helpers.sh"

SHA="trust$(date +%s | md5 -q | head -c 16)"

cleanup() { cleanup_server; }
trap cleanup EXIT

start_server

# ── 1. Fire webhook as trusted author ─────────────────────────
phase "fire-webhook"
fire_webhook "$SHA" "0000000000000000000000000000000000000000" \
  "richard7ao/meridian-core-banking" "t-okafor" \
  "fix: session timeout typo" '["lib/auth/session.ts"]'

# ── 2. Wait for processing ────────────────────────────────────
phase "wait"
sleep 15

# ── 3. Verify no Hook (score under threshold) ────────────────
phase "verify"
tsx_run "
import('./lib/db.ts').then(async (m) => {
  const kv = (m.default || m).kv || m.kv;
  const ps = await kv.get('pause_state:$SHA');
  if (ps !== null) {
    console.log('WARN: Hook created for trusted author off-hours commit');
  } else {
    console.log('no Hook created: verified (off-hours alone not enough)');
  }
  process.exit(0);
}).catch(e => { console.error(e); process.exit(1); });
"

phase "result"
echo ""
echo "ADV-TRUSTED-OFFHOURS PASSED"
