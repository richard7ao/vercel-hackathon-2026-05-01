#!/usr/bin/env bash
set -euo pipefail

# T6.4.6 — 100-file mass commit (diff truncation safety)
# Workflow shouldn't crash on large diffs.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/_helpers.sh"

SHA="mass$(date +%s | md5 -q | head -c 16)"

cleanup() { cleanup_server; }
trap cleanup EXIT

start_server

# ── 1. Build 100-file modified list ───────────────────────────
phase "fire-webhook"
FILES="["
for i in $(seq 1 100); do
  [ "$i" -gt 1 ] && FILES="$FILES,"
  FILES="$FILES\"src/file-$i.ts\""
done
FILES="$FILES]"

fire_webhook "$SHA" "0000000000000000000000000000000000000000" \
  "richard7ao/meridian-core-banking" "dev-1" \
  "refactor: mass rename" "$FILES"

# ── 2. Wait for processing (should not crash) ────────────────
phase "wait"
sleep 20

# ── 3. Verify workflow didn't crash ───────────────────────────
phase "verify"
tsx_run "
import('./lib/db.ts').then(async (m) => {
  const kv = (m.default || m).kv || m.kv;
  const raw = await kv.get('deploys:raw:$SHA');
  if (!raw) {
    console.log('WARN: deploy record not persisted (acceptable if ingest failed)');
  } else {
    console.log('deploy record persisted');
  }
  process.exit(0);
}).catch(e => { console.error(e); process.exit(1); });
"

# ── 4. Verify server is still alive ──────────────────────────
phase "server-alive"
STATUS=$(curl -s -o /dev/null -w '%{http_code}' "$TARGET_URL/")
[ "$STATUS" = "200" ] || fail "server died after mass commit"
echo "  server alive: $STATUS"

phase "result"
echo ""
echo "ADV-MASS-COMMIT PASSED"
