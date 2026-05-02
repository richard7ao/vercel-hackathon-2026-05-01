#!/usr/bin/env bash
set -euo pipefail

# T6.4.1 — Literal "AKIA" in non-secret context must NOT over-fire
# A docs comment mentioning AKIA should not trigger critical.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/_helpers.sh"

SHA="akia$(date +%s | md5 -q | head -c 16)"

cleanup() { cleanup_server; }
trap cleanup EXIT

start_server

# ── 1. Fire webhook with AKIA in a doc comment ────────────────
phase "fire-webhook"
fire_webhook "$SHA" "0000000000000000000000000000000000000000" \
  "richard7ao/meridian-core-banking" "dev-1" \
  "docs: note about AWS key format" '["docs/security-notes.md"]'

# ── 2. Wait for processing ────────────────────────────────────
phase "wait"
sleep 15

# ── 3. Verify no Hook was created (score should be low) ───────
phase "verify"
tsx_run "
import('./lib/db.ts').then(async (m) => {
  const kv = (m.default || m).kv || m.kv;
  const ps = await kv.get('pause_state:$SHA');
  if (ps !== null) {
    console.log('FAIL: Hook created for benign AKIA mention in docs');
    process.exit(1);
  }
  console.log('no Hook created: verified (false-positive resistance)');
  process.exit(0);
}).catch(e => { console.error(e); process.exit(1); });
"

phase "result"
echo ""
echo "ADV-AKIA-COMMENT PASSED"
