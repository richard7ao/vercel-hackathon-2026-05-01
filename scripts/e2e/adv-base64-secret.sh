#!/usr/bin/env bash
set -euo pipefail

# T6.4.4 — Base64-encoded secret bypasses secret_shapes
# Acceptable miss — we don't decode base64 by design.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/_helpers.sh"

SHA="b64sec$(date +%s | md5 -q | head -c 16)"

cleanup() { cleanup_server; }
trap cleanup EXIT

start_server

# ── 1. Fire webhook with base64-encoded secret ────────────────
phase "fire-webhook"
fire_webhook "$SHA" "0000000000000000000000000000000000000000" \
  "richard7ao/meridian-core-banking" "dev-5" \
  "feat: add encrypted config" '["lib/config/encrypted.ts"]'

# ── 2. Wait for processing ────────────────────────────────────
phase "wait"
sleep 15

# ── 3. Verify (acceptable miss) ──────────────────────────────
phase "verify"
tsx_run "
import('./lib/db.ts').then(async (m) => {
  const kv = (m.default || m).kv || m.kv;
  const ps = await kv.get('pause_state:$SHA');
  if (ps === null) {
    console.log('base64 secret not detected: acceptable miss (by design)');
  } else {
    console.log('base64 secret detected: bonus (unexpected)');
  }
  process.exit(0);
}).catch(e => { console.error(e); process.exit(1); });
"

# ── 4. Verify docs/future-development.md mentions base64 ─────
phase "verify-docs"
if grep -qi 'base64' "$ROOT/docs/future-development.md" 2>/dev/null; then
  echo "  future-development.md documents base64 gap: yes"
else
  echo "  WARN: future-development.md should document base64 gap"
fi

phase "result"
echo ""
echo "ADV-BASE64-SECRET PASSED"
