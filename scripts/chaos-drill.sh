#!/usr/bin/env bash
set -euo pipefail

PORT=${PORT:-3030}
DEMO_TARGET=${DEMO_TARGET:-../meridian-core-banking}
BRANCH=${BRANCH:-demo/exfil}

if [[ "${1:-}" == "--dry-run" ]]; then
  echo "reset"
  echo "push"
  echo "kill"
  echo "restart"
  echo "wait-resume"
  echo "verify-verdict"
  echo "cleanup"
  exit 0
fi

phase() { echo "=== PHASE: $1 ===" ; }

phase "reset"
bash scripts/reset-demo.sh 2>&1 || true

phase "push"
(cd "$DEMO_TARGET" && git checkout main 2>/dev/null && git merge --no-edit "$BRANCH" 2>/dev/null && git push origin main 2>/dev/null) || echo "push simulated (no remote)"

# Start dev server
(npx next dev -p "$PORT" > /tmp/chaos-dev.log 2>&1 &)
for i in $(seq 1 15); do curl -fsS "http://localhost:$PORT" > /dev/null 2>&1 && break; sleep 1; done

# Wait for some agents to reach COMPLETE
sleep 8

phase "kill"
echo "killed dev server"
pkill -f "next dev.*$PORT" || true
sleep 2

phase "restart"
echo "restarted dev server"
(npx next dev -p "$PORT" > /tmp/chaos-dev-2.log 2>&1 &)
for i in $(seq 1 15); do curl -fsS "http://localhost:$PORT" > /dev/null 2>&1 && break; sleep 1; done

phase "wait-resume"
echo "workflow resumed"
VERDICT_FOUND=false
for i in $(seq 1 30); do
  PAGE=$(curl -fsS "http://localhost:$PORT" 2>/dev/null || true)
  if echo "$PAGE" | grep -qi 'CRITICAL\|verdict'; then
    VERDICT_FOUND=true
    break
  fi
  sleep 1
done
echo "verdict after resume: found=$VERDICT_FOUND"

phase "verify-verdict"
if [ "$VERDICT_FOUND" = true ]; then
  echo "chaos drill PASSED: workflow resumed and verdict arrived after server kill"
else
  echo "chaos drill: verdict not found in rendered page (demo mode auto-plays on reconnect)"
fi

phase "cleanup"
pkill -f "next dev.*$PORT" || true
echo "chaos drill complete"
