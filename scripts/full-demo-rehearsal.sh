#!/usr/bin/env bash
set -euo pipefail

PORT=${PORT:-3030}
DEMO_TARGET=${DEMO_TARGET:-../meridian-core-banking}
BRANCH=${BRANCH:-demo/exfil}

if [[ "${1:-}" == "--dry-run" ]]; then
  echo "reset"
  echo "push"
  echo "verdict"
  echo "ack"
  echo "cleanup"
  exit 0
fi

phase() { echo "=== PHASE: $1 ===" ; }

phase "reset"
bash scripts/reset-demo.sh 2>&1 || true

phase "push"
(cd "$DEMO_TARGET" && git checkout main 2>/dev/null && git merge --no-edit "$BRANCH" 2>/dev/null && git push origin main 2>/dev/null) || echo "push simulated (no remote)"

phase "verdict"
# Start dev server and wait for verdict to appear
(npx next dev -p "$PORT" > /tmp/rehearsal-dev.log 2>&1 &)
for i in $(seq 1 15); do curl -fsS "http://localhost:$PORT" > /dev/null 2>&1 && break; sleep 1; done

START=$(date +%s)
VERDICT_FOUND=false
for i in $(seq 1 60); do
  PAGE=$(curl -fsS "http://localhost:$PORT" 2>/dev/null || true)
  if echo "$PAGE" | grep -qi 'CRITICAL\|verdict'; then
    VERDICT_FOUND=true
    break
  fi
  sleep 1
done
END=$(date +%s)
echo "verdict wait: $((END - START))s | found=$VERDICT_FOUND"

phase "ack"
echo "ack simulated (no discord webhook in rehearsal)"

phase "cleanup"
pkill -f "next dev.*$PORT" || true
echo "rehearsal complete"
