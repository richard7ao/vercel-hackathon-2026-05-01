#!/usr/bin/env bash
# Shared helpers for E2E test scripts

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
source "$ROOT/.env.local" 2>/dev/null || true

PORT=${PORT:-3030}
TARGET_URL="${BRIDGE_TARGET_URL:-http://localhost:$PORT}"
DT="$(cat "$ROOT/.demo-target-path" 2>/dev/null || echo "../meridian-core-banking")"
REPO_PATH="$(cd "$ROOT/$DT" 2>/dev/null && pwd || echo "")"
WATERMARK="$(cat "$ROOT/.demo-watermark" 2>/dev/null || echo "")"
export DOTENV_CONFIG_PATH="$ROOT/.env.local"

phase() { printf '\n=== %s ===\n' "$1"; }
fail()  { echo "FAIL: $1"; exit 1; }

tsx_run() {
  (cd "$ROOT" && /opt/homebrew/bin/npx tsx --require dotenv/config -e "$1")
}

kv_get() {
  tsx_run "
const { redisGet } = require('./lib/db-redis.ts');
async function main() {
  const v = await redisGet('$1');
  if (v === null) { console.log('null'); }
  else { console.log(v); }
  process.exit(0);
}
main().catch(() => { console.log('null'); process.exit(0); });
" 2>/dev/null
}

start_server() {
  if [ "$TARGET_URL" = "http://localhost:$PORT" ]; then
    phase "start-server"
    (cd "$ROOT" && npx next dev -p "$PORT" > /tmp/e2e-dev.log 2>&1 &)
    for i in $(seq 1 20); do
      curl -fsS "http://localhost:$PORT" > /dev/null 2>&1 && break
      sleep 1
    done
    echo "server ready on :$PORT"
  fi
}

stop_server() {
  pkill -f "next dev.*$PORT" 2>/dev/null || true
}

cleanup_server() {
  if [ "$TARGET_URL" = "http://localhost:$PORT" ]; then
    stop_server
  fi
}

fire_webhook() {
  local sha="$1" before="$2" repo_name="$3" author="$4" message="$5" files="$6"
  local PAYLOAD
  PAYLOAD=$(cat <<EOJSON
{
  "ref": "refs/heads/main",
  "before": "$before",
  "after": "$sha",
  "repository": {"full_name": "$repo_name"},
  "head_commit": {
    "id": "$sha",
    "author": {"username": "$author", "email": "${author}@meridian.bank"},
    "message": "$message",
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  },
  "commits": [{"id": "$sha", "added": [], "removed": [], "modified": $files}]
}
EOJSON
)
  local SIGNATURE="sha256=$(echo -n "$PAYLOAD" | openssl dgst -sha256 -hmac "$GITHUB_WEBHOOK_SECRET" | awk '{print $NF}')"
  local STATUS
  STATUS=$(curl -s -o /tmp/e2e-webhook-resp.json -w '%{http_code}' \
    -X POST "$TARGET_URL/api/webhooks/github" \
    -H "Content-Type: application/json" \
    -H "x-github-event: push" \
    -H "x-hub-signature-256: $SIGNATURE" \
    --data "$PAYLOAD")
  echo "webhook response: $STATUS"
  [ "$STATUS" = "200" ] || fail "webhook returned $STATUS"
}

trigger_demo() {
  local sha="$1" score="${2:-0.9}"
  local STATUS
  STATUS=$(curl -s -o /tmp/e2e-trigger-resp.json -w '%{http_code}' \
    -X POST "$TARGET_URL/api/demo/trigger" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $DEMO_RESET_TOKEN" \
    --data "{\"sha\":\"$sha\",\"score\":$score}")
  echo "trigger response: $STATUS" >&2
  [ "$STATUS" = "200" ] || fail "trigger returned $STATUS"
}

resume_demo() {
  local deploy_id="$1" action="${2:-ack}" username="${3:-e2e-test}"
  local STATUS
  STATUS=$(curl -s -o /tmp/e2e-resume-resp.json -w '%{http_code}' \
    -X POST "$TARGET_URL/api/demo/resume" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $DEMO_RESET_TOKEN" \
    --data "{\"deploy_id\":\"$deploy_id\",\"action_type\":\"$action\",\"username\":\"$username\"}")
  echo "resume response: $STATUS" >&2
  echo "$STATUS"
}

wait_for_pause() {
  local sha="$1" timeout_s="${2:-60}"
  for i in $(seq 1 "$timeout_s"); do
    local PAUSE
    PAUSE=$(kv_get "pause_state:$sha")
    if [ "$PAUSE" != "null" ] && [ -n "$PAUSE" ]; then
      echo "  pause_state:$sha found after ${i}s"
      return 0
    fi
    sleep 1
  done
  fail "pause_state:$sha not found within ${timeout_s}s"
}

wait_for_verdict() {
  local sha="$1" timeout_s="${2:-30}"
  for i in $(seq 1 "$timeout_s"); do
    local V
    V=$(kv_get "verdicts:$sha")
    if [ "$V" != "null" ] && [ -n "$V" ]; then
      echo "  verdicts:$sha found after ${i}s"
      echo "$V"
      return 0
    fi
    sleep 1
  done
  fail "verdicts:$sha not found within ${timeout_s}s"
}

merge_demo_branch() {
  local branch="$1"
  [ -n "$REPO_PATH" ] || fail "REPO_PATH not set"
  cd "$REPO_PATH"
  git checkout main >/dev/null 2>&1
  git reset --hard "$WATERMARK" >/dev/null 2>&1
  git merge --ff-only "$branch" >/dev/null 2>&1 || git merge "$branch" --no-edit >/dev/null 2>&1
  local SHA
  SHA=$(git rev-parse HEAD)
  if git remote get-url origin &>/dev/null; then
    git push --force-with-lease origin main >/dev/null 2>&1 || true
  fi
  cd "$ROOT"
  echo "$SHA"
}

reset_demo_repo() {
  [ -n "$REPO_PATH" ] || return
  cd "$REPO_PATH" && git checkout main 2>/dev/null && git reset --hard "$WATERMARK" 2>/dev/null || true
  cd "$ROOT"
}
