#!/usr/bin/env bash
set -euo pipefail

# T6.7.2 — Production demo rehearsal
# Uses /api/demo/trigger (bypasses GitHub ingest) to run a full
# trigger → pause → resume → verdict cycle against the production URL.
#
# Usage:
#   BRIDGE_TARGET_URL=https://vercel-hackathon-2026-05-01.vercel.app \
#     bash scripts/e2e/rehearsal.sh [runs] [action]
#
# runs:   number of rehearsals (default 5)
# action: ack|hold|page (default cycles through all three)

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/_helpers.sh"

RUNS="${1:-5}"
ACTIONS=("ack" "hold" "page")
PASSED=0
FAILED=0

for i in $(seq 1 "$RUNS"); do
  ACTION="${2:-${ACTIONS[$(( (i - 1) % 3 ))]}}"
  SHA="rehearsal$(date +%s%N | md5 -q | head -c 12)"
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "  REHEARSAL $i/$RUNS — sha=$SHA action=$ACTION"
  echo "  target=$TARGET_URL"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

  # ── 1. Trigger ──────────────────────────────────────────
  phase "trigger"
  trigger_demo "$SHA" 0.9

  # ── 2. Wait for Hook pause ─────────────────────────────
  phase "wait-for-pause"
  wait_for_pause "$SHA" 90

  # ── 3. Verify pause_state shape ────────────────────────
  phase "check-pause-state"
  PAUSE=$(kv_get "pause_state:$SHA")
  echo "  pause_state: $PAUSE"
  echo "$PAUSE" | grep -q "hook_token" || { echo "FAIL: missing hook_token"; FAILED=$((FAILED + 1)); continue; }
  echo "$PAUSE" | grep -q "paused_at" || { echo "FAIL: missing paused_at"; FAILED=$((FAILED + 1)); continue; }

  # ── 4. Check verdict written by synthesizer ────────────
  phase "check-pre-resume-verdict"
  PRE_VERDICT=$(kv_get "verdicts:$SHA")
  echo "  pre-resume verdict: ${PRE_VERDICT:0:120}"
  echo "$PRE_VERDICT" | grep -q "level" || echo "  WARN: no verdict level yet (synthesizer may still be writing)"

  # ── 5. Resume ──────────────────────────────────────────
  phase "resume ($ACTION)"
  RESUME_STATUS=$(resume_demo "$SHA" "$ACTION" "rehearsal-user-$i")
  [ "$RESUME_STATUS" = "200" ] || { echo "FAIL: resume returned $RESUME_STATUS"; FAILED=$((FAILED + 1)); continue; }

  # ── 6. Wait for verdict update + pause cleanup ─────────
  phase "verify-post-resume"
  sleep 5

  POST_VERDICT=$(kv_get "verdicts:$SHA")
  echo "  post-resume verdict: ${POST_VERDICT:0:200}"

  CLEANED_PAUSE=$(kv_get "pause_state:$SHA")

  CHECKS_OK=true

  case "$ACTION" in
    ack)
      echo "$POST_VERDICT" | grep -q "acknowledged_at" || { echo "  FAIL: no acknowledged_at"; CHECKS_OK=false; }
      echo "$POST_VERDICT" | grep -q "rehearsal-user-$i" || { echo "  FAIL: wrong acknowledged_by"; CHECKS_OK=false; }
      ;;
    hold)
      echo "$POST_VERDICT" | grep -q "held_until" || echo "$POST_VERDICT" | grep -q "acknowledged_at" || { echo "  FAIL: no held_until or acknowledged_at"; CHECKS_OK=false; }
      ;;
    page)
      echo "$POST_VERDICT" | grep -q "paged_at" || echo "$POST_VERDICT" | grep -q "acknowledged_at" || { echo "  FAIL: no paged_at or acknowledged_at"; CHECKS_OK=false; }
      ;;
  esac

  if [ "$CLEANED_PAUSE" = "null" ] || [ -z "$CLEANED_PAUSE" ]; then
    echo "  pause_state cleaned up: YES"
  else
    echo "  WARN: pause_state still present (WDK async cleanup)"
  fi

  if [ "$CHECKS_OK" = "true" ]; then
    echo "  RESULT: PASS"
    PASSED=$((PASSED + 1))
  else
    echo "  RESULT: FAIL"
    FAILED=$((FAILED + 1))
  fi
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  REHEARSAL SUMMARY: $PASSED/$RUNS passed, $FAILED failed"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

[ "$FAILED" -eq 0 ] || exit 1
echo "ALL REHEARSALS PASSED"
