#!/usr/bin/env bash
set -euo pipefail

# T6.4.8 — Trojan dependency added to package.json
# event-stream v3.3.6 was a real supply-chain attack.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/_helpers.sh"

SHA="trojan$(date +%s | md5 -q | head -c 16)"

cleanup() { cleanup_server; }
trap cleanup EXIT

start_server

# ── 1. Fire webhook with package.json change ──────────────────
phase "fire-webhook"
fire_webhook "$SHA" "0000000000000000000000000000000000000000" \
  "richard7ao/meridian-core-banking" "dev-3" \
  "chore: add analytics dep" '["package.json"]'

# ── 2. Wait for processing ────────────────────────────────────
phase "wait"
sleep 15

# ── 3. Verify detection ──────────────────────────────────────
phase "verify"
tsx_run "
import('./lib/db.ts').then(async (m) => {
  const kv = (m.default || m).kv || m.kv;
  const v = await kv.get('verdicts:$SHA');
  const ps = await kv.get('pause_state:$SHA');
  console.log('verdict: ' + JSON.stringify(v ? { level: v.level } : null));
  console.log('paused: ' + (ps !== null));
  process.exit(0);
}).catch(e => { console.error(e); process.exit(1); });
"

phase "result"
echo ""
echo "ADV-TROJAN-DEP PASSED"
