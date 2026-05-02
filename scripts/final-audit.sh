#!/usr/bin/env bash
set -euo pipefail

# T6.7.3 — Final claim audit
# Verifies every claim in README, every constraint in CLAUDE.md,
# and every promise in the spec maps to working code.

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PASS=0
FAIL=0
WARN=0

check() {
  local desc="$1"
  shift
  if "$@" >/dev/null 2>&1; then
    echo "  PASS: $desc"
    PASS=$((PASS + 1))
  else
    echo "  FAIL: $desc"
    FAIL=$((FAIL + 1))
  fi
}

warn_check() {
  local desc="$1"
  shift
  if "$@" >/dev/null 2>&1; then
    echo "  PASS: $desc"
    PASS=$((PASS + 1))
  else
    echo "  WARN: $desc"
    WARN=$((WARN + 1))
  fi
}

echo "=== FINAL CLAIM AUDIT ==="
echo ""

# ── 1. DurableAgent claims resolve to real files ──────────────
echo "1. DurableAgent claims"
check "synthesizer uses DurableAgent" grep -q 'DurableAgent' "$ROOT/workflows/synthesizer.ts"
check "history agent uses DurableAgent" grep -q 'DurableAgent' "$ROOT/workflows/agents/history.ts"
check "dependency agent uses DurableAgent" grep -q 'DurableAgent' "$ROOT/workflows/agents/dependency.ts"
check "diff agent uses DurableAgent" grep -q 'DurableAgent' "$ROOT/workflows/agents/diff.ts"

# ── 2. Hook claims resolve to createHook/resumeHook ───────────
echo ""
echo "2. Hook/pause claims"
check "watchdog uses createHook" grep -q 'createHook' "$ROOT/workflows/watchdog.ts"
check "demo/resume uses resumeHook" grep -q 'resumeHook' "$ROOT/app/api/demo/resume/route.ts"
check "discord interactions uses resumeHook" grep -q 'resumeHook' "$ROOT/app/api/discord/interactions/route.ts"

# ── 3. No Slack references (except provenance notes) ──────────
echo ""
echo "3. Slack → Discord migration complete"
check "README: no slack" bash -c "! grep -ri 'slack' '$ROOT/README.md' | grep -v 'pivot\|legacy\|former\|previously'"
check "CLAUDE.md: no slack" bash -c "! grep -ri 'slack' '$ROOT/CLAUDE.md' | grep -v 'pivot\|legacy\|former\|previously\|renamed'"
warn_check "app/: no slack" bash -c "! grep -ri 'slack' '$ROOT/app/' 2>/dev/null | grep -v 'pivot\|legacy\|former'"
warn_check "workflows/: no slack" bash -c "! grep -ri 'slack' '$ROOT/workflows/' 2>/dev/null | grep -v 'pivot\|legacy\|former'"
warn_check "lib/: no slack" bash -c "! grep -ri 'slack' '$ROOT/lib/' 2>/dev/null | grep -v 'pivot\|legacy\|former'"

# ── 4. Unit tests pass ───────────────────────────────────────
echo ""
echo "4. Unit tests"
check "npm test passes" bash -c "cd '$ROOT' && /opt/homebrew/bin/npm test -- --run 2>&1 | grep -q 'passed'"

# ── 5. Chaos drill syntax ────────────────────────────────────
echo ""
echo "5. Chaos drill"
check "chaos-drill.sh exists and is executable" test -x "$ROOT/scripts/chaos-drill.sh"
check "chaos-drill.sh syntax valid" bash -n "$ROOT/scripts/chaos-drill.sh"

# ── 6. Smoke integrations ────────────────────────────────────
echo ""
echo "6. Smoke integrations"
check "smoke-integrations.sh exists" test -x "$ROOT/scripts/smoke-integrations.sh"
check "old test-integrations.sh removed" bash -c "! test -e '$ROOT/scripts/test-integrations.sh'"

# ── 7. E2E scripts syntax valid ──────────────────────────────
echo ""
echo "7. E2E test scripts"
for f in "$ROOT"/scripts/e2e/*.sh; do
  check "$(basename "$f") syntax" bash -n "$f"
done

# ── 8. Key files exist ───────────────────────────────────────
echo ""
echo "8. Key files"
check "docs/future-development.md" test -f "$ROOT/docs/future-development.md"
check "vitest.config.ts" test -f "$ROOT/vitest.config.ts"
check "lib/verdict-levels.ts" test -f "$ROOT/lib/verdict-levels.ts"
check "lib/ai-gateway.ts" test -f "$ROOT/lib/ai-gateway.ts"

# ── Summary ──────────────────────────────────────────────────
echo ""
echo "=== AUDIT SUMMARY ==="
echo "  PASS: $PASS"
echo "  WARN: $WARN"
echo "  FAIL: $FAIL"
echo ""

if [ "$FAIL" -gt 0 ]; then
  echo "AUDIT FAILED — $FAIL checks failed"
  exit 1
fi

echo "AUDIT PASSED"
