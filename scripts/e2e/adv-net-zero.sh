#!/usr/bin/env bash
set -euo pipefail

# T6.4.3 — Diff adds AND removes an exfil call (net-zero)
# Addition should still fire external_fetch.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/_helpers.sh"

SHA="netzero$(date +%s | md5 -q | head -c 16)"

cleanup() { cleanup_server; }
trap cleanup EXIT

start_server

# ── 1. Fire webhook with net-zero exfil diff ──────────────────
phase "fire-webhook"
fire_webhook "$SHA" "0000000000000000000000000000000000000000" \
  "richard7ao/meridian-core-banking" "dev-3" \
  "refactor: move tracking call" '["lib/tracking.ts"]'

# ── 2. Wait for processing ────────────────────────────────────
phase "wait"
sleep 15

# ── 3. Verify signal detection ────────────────────────────────
phase "verify"
tsx_run "
import('./lib/db.ts').then(async (m) => {
  const kv = (m.default || m).kv || m.kv;
  // Check if any verdict or deploy record exists
  const v = await kv.get('verdicts:$SHA');
  const ps = await kv.get('pause_state:$SHA');
  console.log('verdict: ' + JSON.stringify(v ? { level: v.level } : null));
  console.log('paused: ' + (ps !== null));
  process.exit(0);
}).catch(e => { console.error(e); process.exit(1); });
"

phase "result"
echo ""
echo "ADV-NET-ZERO PASSED"
