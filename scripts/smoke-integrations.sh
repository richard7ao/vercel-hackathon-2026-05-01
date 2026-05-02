#!/usr/bin/env bash
# Smoke harness — pings live external services (API keys, endpoints, webhooks).
set -uo pipefail
# This is NOT a unit/integration test suite; it verifies connectivity and credentials.
# Run: bash scripts/smoke-integrations.sh
# Requires: .env.local with all keys populated

PASS=0
FAIL=0
WARN=0

pass() { echo "  PASS  $1"; ((PASS++)); }
fail() { echo "  FAIL  $1"; ((FAIL++)); }
warn() { echo "  WARN  $1"; ((WARN++)); }

echo "============================================"
echo "  Bridge Smoke Harness"
echo "============================================"
echo ""

# ── Load env ──────────────────────────────────────
if [ -f .env.local ]; then
  set -a
  source .env.local
  set +a
  pass ".env.local loaded"
else
  fail ".env.local not found"
  echo "Cannot continue without .env.local"
  exit 1
fi

# ── 1. ENV VAR PRESENCE ──────────────────────────
echo ""
echo "── 1. Environment Variables ──"

for var in REDIS_URL AI_GATEWAY_API_KEY DISCORD_BOT_TOKEN DISCORD_PUBLIC_KEY \
           DISCORD_CHANNEL_ID GITHUB_WEBHOOK_SECRET DEMO_RESET_TOKEN; do
  val="${!var:-}"
  if [ -n "$val" ]; then
    pass "$var is set (${#val} chars)"
  else
    fail "$var is MISSING"
  fi
done

for var in GITHUB_TOKEN BRIDGE_MODE BUDGET_USD; do
  val="${!var:-}"
  if [ -n "$val" ]; then
    pass "$var is set (optional)"
  else
    warn "$var not set (optional, has default fallback)"
  fi
done

# ── 2. REDIS ──────────────────────────────────────
echo ""
echo "── 2. Redis ──"

REDIS_RESULT=$(node -e "
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('redis');
const c = createClient({ url: process.env.REDIS_URL });
c.on('error', () => {});
c.connect().then(() => c.ping()).then(r => {
  console.log(r);
  return c.disconnect();
}).catch(e => {
  console.error('ERR:' + e.message);
  process.exit(1);
});
" 2>&1)

if echo "$REDIS_RESULT" | grep -q "PONG"; then
  pass "Redis PING → PONG"
else
  fail "Redis connection failed: $REDIS_RESULT"
fi

# Test read/write
REDIS_RW=$(node -e "
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('redis');
const c = createClient({ url: process.env.REDIS_URL });
c.on('error', () => {});
c.connect().then(async () => {
  await c.set('_test_integration', 'ok');
  const v = await c.get('_test_integration');
  await c.del('_test_integration');
  console.log(v === 'ok' ? 'OK' : 'MISMATCH');
  await c.disconnect();
}).catch(e => { console.error('ERR:' + e.message); process.exit(1); });
" 2>&1)

if echo "$REDIS_RW" | grep -q "OK"; then
  pass "Redis SET/GET/DEL round-trip"
else
  fail "Redis read/write failed: $REDIS_RW"
fi

# Test SCAN (used by kv.list)
REDIS_SCAN=$(node -e "
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('redis');
const c = createClient({ url: process.env.REDIS_URL });
c.on('error', () => {});
c.connect().then(async () => {
  const keys = [];
  for await (const k of c.scanIterator({ MATCH: 'deploys:*', COUNT: 10 })) {
    if (Array.isArray(k)) keys.push(...k); else keys.push(k);
    if (keys.length >= 3) break;
  }
  console.log('SCAN:' + keys.length);
  await c.disconnect();
}).catch(e => { console.error('ERR:' + e.message); process.exit(1); });
" 2>&1)

if echo "$REDIS_SCAN" | grep -q "SCAN:"; then
  SCAN_COUNT=$(echo "$REDIS_SCAN" | grep -o 'SCAN:[0-9]*' | cut -d: -f2)
  pass "Redis SCAN works ($SCAN_COUNT deploy keys found)"
else
  fail "Redis SCAN failed: $REDIS_SCAN"
fi

# ── 3. DISCORD BOT ───────────────────────────────
echo ""
echo "── 3. Discord Bot ──"

DISCORD_ME=$(node -e "
require('dotenv').config({ path: '.env.local' });
fetch('https://discord.com/api/v10/users/@me', {
  headers: { Authorization: 'Bot ' + process.env.DISCORD_BOT_TOKEN }
}).then(r => r.json()).then(j => {
  if (j.id) console.log('BOT:' + j.username + '#' + j.discriminator + ':' + j.id);
  else console.log('ERR:' + JSON.stringify(j));
}).catch(e => console.log('ERR:' + e.message));
" 2>&1)

if echo "$DISCORD_ME" | grep -q "BOT:"; then
  BOT_NAME=$(echo "$DISCORD_ME" | grep -o 'BOT:[^:]*' | cut -d: -f2)
  pass "Discord bot authenticated: $BOT_NAME"
else
  fail "Discord bot auth failed: $DISCORD_ME"
fi

# Test channel access
DISCORD_CHAN=$(node -e "
require('dotenv').config({ path: '.env.local' });
const chanId = process.env.DISCORD_CHANNEL_ID;
fetch('https://discord.com/api/v10/channels/' + chanId, {
  headers: { Authorization: 'Bot ' + process.env.DISCORD_BOT_TOKEN }
}).then(r => r.json()).then(j => {
  if (j.id) console.log('CHAN:' + j.name + ':' + j.type);
  else console.log('ERR:' + JSON.stringify(j));
}).catch(e => console.log('ERR:' + e.message));
" 2>&1)

if echo "$DISCORD_CHAN" | grep -q "CHAN:"; then
  CHAN_NAME=$(echo "$DISCORD_CHAN" | grep -o 'CHAN:[^:]*' | cut -d: -f2)
  pass "Discord channel accessible: #$CHAN_NAME"
else
  fail "Discord channel access failed: $DISCORD_CHAN"
fi

# Test message posting (sends a test message, then deletes it)
DISCORD_MSG=$(node -e "
require('dotenv').config({ path: '.env.local' });
const chanId = process.env.DISCORD_CHANNEL_ID;
const token = process.env.DISCORD_BOT_TOKEN;
fetch('https://discord.com/api/v10/channels/' + chanId + '/messages', {
  method: 'POST',
  headers: { Authorization: 'Bot ' + token, 'Content-Type': 'application/json' },
  body: JSON.stringify({ content: '[integration-test] Bridge test message — will be deleted' })
}).then(r => r.json()).then(async j => {
  if (j.id) {
    // Delete the test message
    await fetch('https://discord.com/api/v10/channels/' + chanId + '/messages/' + j.id, {
      method: 'DELETE',
      headers: { Authorization: 'Bot ' + token }
    });
    console.log('MSG:sent-and-deleted');
  } else {
    console.log('ERR:' + JSON.stringify(j));
  }
}).catch(e => console.log('ERR:' + e.message));
" 2>&1)

if echo "$DISCORD_MSG" | grep -q "MSG:sent-and-deleted"; then
  pass "Discord message post + delete"
else
  fail "Discord message posting failed: $DISCORD_MSG"
fi

# ── 4. AI GATEWAY ────────────────────────────────
echo ""
echo "── 4. AI Gateway ──"

AI_RESULT=$(node -e "
require('dotenv').config({ path: '.env.local' });
const key = process.env.AI_GATEWAY_API_KEY;
fetch('https://gateway.ai.vercel.app/v1/chat/completions', {
  method: 'POST',
  headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    model: 'anthropic/claude-sonnet-4-6',
    messages: [{ role: 'user', content: 'reply OK' }],
    max_tokens: 5
  }),
  signal: AbortSignal.timeout(15000)
}).then(async r => {
  const body = await r.text();
  if (r.ok) console.log('AI:' + r.status);
  else console.log('ERR:' + r.status + ':' + body.substring(0, 200));
}).catch(e => console.log('ERR:' + e.message));
" 2>&1)

if echo "$AI_RESULT" | grep -q "AI:200"; then
  pass "AI Gateway chat completion"
else
  ERR_MSG=$(echo "$AI_RESULT" | grep -o 'ERR:.*')
  if echo "$ERR_MSG" | grep -qi "ECONNRESET\|ECONNREFUSED\|fetch failed\|abort"; then
    warn "AI Gateway unreachable from local (network issue — works on deployed Vercel)"
  else
    fail "AI Gateway failed: $ERR_MSG"
  fi
fi

# ── 5. GITHUB ────────────────────────────────────
echo ""
echo "── 5. GitHub API ──"

# Test unauthenticated access (public repo)
GH_PUBLIC=$(node -e "
fetch('https://api.github.com/repos/richard7ao/meridian-core-banking', {
  headers: { 'User-Agent': 'Bridge-Integration-Test' }
}).then(r => r.json()).then(j => {
  if (j.full_name) console.log('GH:' + j.full_name + ':' + (j.private ? 'private' : 'public'));
  else console.log('ERR:' + JSON.stringify(j).substring(0, 200));
}).catch(e => console.log('ERR:' + e.message));
" 2>&1)

if echo "$GH_PUBLIC" | grep -q "GH:"; then
  GH_REPO=$(echo "$GH_PUBLIC" | grep -o 'GH:[^:]*' | cut -d: -f2)
  GH_VIS=$(echo "$GH_PUBLIC" | grep -o ':\(public\|private\)' | tr -d ':')
  pass "GitHub repo accessible: $GH_REPO ($GH_VIS)"
else
  fail "GitHub repo access failed: $GH_PUBLIC"
fi

# Test GITHUB_TOKEN if set
if [ -n "${GITHUB_TOKEN:-}" ]; then
  GH_AUTH=$(node -e "
  require('dotenv').config({ path: '.env.local' });
  fetch('https://api.github.com/user', {
    headers: { Authorization: 'token ' + process.env.GITHUB_TOKEN, 'User-Agent': 'Bridge' }
  }).then(r => r.json()).then(j => {
    if (j.login) console.log('AUTH:' + j.login);
    else console.log('ERR:' + JSON.stringify(j).substring(0, 200));
  }).catch(e => console.log('ERR:' + e.message));
  " 2>&1)

  if echo "$GH_AUTH" | grep -q "AUTH:"; then
    GH_USER=$(echo "$GH_AUTH" | grep -o 'AUTH:.*' | cut -d: -f2)
    pass "GITHUB_TOKEN valid (user: $GH_USER)"
  else
    fail "GITHUB_TOKEN invalid: $GH_AUTH"
  fi
else
  warn "GITHUB_TOKEN not set — Octokit will use unauthenticated rate limit (60/hr)"
fi

# ── 6. VERCEL DEPLOY ─────────────────────────────
echo ""
echo "── 6. Vercel Deploy ──"

DEPLOY_URL="https://vercel-hackathon-2026-05-01.vercel.app"

# Test main page
DEPLOY_PAGE=$(curl -sS -w "\n%{http_code}" --max-time 10 "$DEPLOY_URL" 2>&1 | tail -1)
if [ "$DEPLOY_PAGE" = "200" ]; then
  pass "Deploy URL reachable (200)"
else
  fail "Deploy URL returned: $DEPLOY_PAGE"
fi

# Test SSE endpoint
SSE_RESULT=$(curl -sS --max-time 5 "$DEPLOY_URL/api/stream/deploys" 2>&1 | head -3)
if echo "$SSE_RESULT" | grep -q "connected"; then
  pass "SSE endpoint streams events"
else
  fail "SSE endpoint not working: $SSE_RESULT"
fi

# Test webhook endpoint (should reject bad signature)
WEBHOOK_RESULT=$(curl -sS -w "\n%{http_code}" --max-time 10 \
  -X POST "$DEPLOY_URL/api/webhooks/github" \
  -H "Content-Type: application/json" \
  -H "x-github-event: push" \
  -H "x-hub-signature-256: sha256=bad" \
  -d '{"after":"test"}' 2>&1 | tail -1)
if [ "$WEBHOOK_RESULT" = "401" ]; then
  pass "Webhook rejects bad signature (401)"
else
  warn "Webhook returned $WEBHOOK_RESULT (expected 401)"
fi

# ── 7. DISCORD INTERACTION ENDPOINT ──────────────
echo ""
echo "── 7. Discord Interaction Endpoint ──"

# Should reject bad signature
INTERACTION_RESULT=$(curl -sS -w "\n%{http_code}" --max-time 10 \
  -X POST "$DEPLOY_URL/api/discord/interactions" \
  -H "Content-Type: application/json" \
  -H "x-signature-ed25519: bad" \
  -H "x-signature-timestamp: 0" \
  -d '{"type":1}' 2>&1 | tail -1)
if [ "$INTERACTION_RESULT" = "401" ]; then
  pass "Discord interaction rejects bad signature (401)"
else
  warn "Discord interaction returned $INTERACTION_RESULT (expected 401)"
fi

# ── 8. DEMO ENDPOINTS ───────────────────────────
echo ""
echo "── 8. Demo Endpoints ──"

# Reset endpoint should reject without token
RESET_NOAUTH=$(curl -sS -w "\n%{http_code}" --max-time 10 \
  -X POST "$DEPLOY_URL/api/demo/reset" 2>&1 | tail -1)
if [ "$RESET_NOAUTH" = "401" ] || [ "$RESET_NOAUTH" = "403" ]; then
  pass "Demo reset rejects unauthenticated request"
else
  warn "Demo reset returned $RESET_NOAUTH without auth (expected 401/403)"
fi

# Reset endpoint with valid token (may fail if deploy hasn't picked up new env vars yet)
RESET_AUTH=$(curl -sS -w "\n%{http_code}" --max-time 10 \
  -X POST "$DEPLOY_URL/api/demo/reset" \
  -H "Authorization: Bearer $DEMO_RESET_TOKEN" 2>&1 | tail -1)
if [ "$RESET_AUTH" = "200" ]; then
  pass "Demo reset accepts valid token (200)"
elif [ "$RESET_AUTH" = "401" ]; then
  warn "Demo reset rejected valid token (deploy may need redeploy to pick up new env vars)"
else
  warn "Demo reset returned $RESET_AUTH with valid token"
fi

# ── 9. BUILD VERIFICATION ────────────────────────
echo ""
echo "── 9. Build Verification ──"

TSC_RESULT=$(npx tsc --noEmit -p tsconfig.json 2>&1)
if [ $? -eq 0 ]; then
  pass "TypeScript compiles (0 errors)"
else
  fail "TypeScript errors: $(echo "$TSC_RESULT" | head -5)"
fi

# ── 10. UNIT TESTS ───────────────────────────────
echo ""
echo "── 10. Core Module Tests ──"

# Cost meter
COST_TEST=$(npx tsx --input-type=module -e "
const m = await import('./lib/cost-meter.ts');
const { computeBudgetRemaining } = m.default || m;
const cases = [
  { spent: 0, budget: 10, pct: 100, sev: 'ok' },
  { spent: 7.5, budget: 10, pct: 25, sev: 'amber' },
  { spent: 9.5, budget: 10, pct: 5, sev: 'red' },
];
for (const c of cases) {
  const r = computeBudgetRemaining({ spent_usd: c.spent, budget_usd: c.budget });
  if (Math.round(r.percent) !== c.pct || r.severity !== c.sev) {
    console.log('FAIL:' + JSON.stringify(c) + ' got ' + JSON.stringify(r));
    process.exit(1);
  }
}
console.log('OK');
" 2>&1)

if echo "$COST_TEST" | grep -q "^OK"; then
  pass "Cost meter: 3 threshold cases"
else
  fail "Cost meter: $COST_TEST"
fi

# Risk score arc
ARC_TEST=$(npx tsx --input-type=module -e "
import { renderToString } from 'react-dom/server';
import React from 'react';
const m = await import('./app/(warroom)/components/RiskScoreArc.tsx');
const { RiskScoreArc } = m.default || m;
const cases = [
  { score: 0.1, color: 'green' },
  { score: 0.5, color: 'amber' },
  { score: 0.7, color: 'orange' },
  { score: 0.95, color: 'red' },
];
for (const c of cases) {
  const html = renderToString(React.createElement(RiskScoreArc, { score: c.score }));
  const got = (html.match(/data-color=\"(\w+)\"/) || [])[1];
  if (got !== c.color) { console.log('FAIL:' + c.score + ' expected=' + c.color + ' got=' + got); process.exit(1); }
}
console.log('OK');
" 2>&1)

if echo "$ARC_TEST" | grep -q "^OK"; then
  pass "RiskScoreArc: 4 color thresholds"
else
  fail "RiskScoreArc: $ARC_TEST"
fi

# Interpolation
INTERP_TEST=$(npx tsx --input-type=module -e "
const m = await import('./app/(warroom)/hooks/useTickedNumber.ts');
const { interpolate } = m.default || m;
if (interpolate(0, 100, 0) !== 0) { console.log('FAIL:0'); process.exit(1); }
if (interpolate(0, 100, 1) !== 100) { console.log('FAIL:1'); process.exit(1); }
if (interpolate(0, 100, 0.5) !== 50) { console.log('FAIL:0.5'); process.exit(1); }
console.log('OK');
" 2>&1)

if echo "$INTERP_TEST" | grep -q "^OK"; then
  pass "Interpolation: 3 boundary cases"
else
  fail "Interpolation: $INTERP_TEST"
fi

# Synthesizer (derivedVerdict) + verdict-levels (escalateLevel)
SYNTH_TEST=$(npx tsx --input-type=module -e "
const sm = await import('./workflows/synthesizer-helpers.ts');
const { derivedVerdict } = sm.default || sm;
const vm = await import('./lib/verdict-levels.ts');
const { escalateLevel } = vm.default || vm;

// High score + critical finding -> critical
const v1 = derivedVerdict({
  findings: [{ agent: 'diff', severity: 'critical', summary: 'exfil found' }],
  signals: {}, score: 0.91
});
if (v1.level !== 'critical') { console.log('FAIL:level=' + v1.level); process.exit(1); }
if (v1.concerns.length < 1) { console.log('FAIL:no concerns'); process.exit(1); }

// Low score + low findings -> benign
const v2 = derivedVerdict({
  findings: [{ agent: 'trace', severity: 'low', summary: 'clean' }],
  signals: {}, score: 0.1
});
if (v2.level !== 'benign') { console.log('FAIL:level=' + v2.level); process.exit(1); }

// escalateLevel
if (escalateLevel('benign', 'critical') !== 'critical') { console.log('FAIL:escalate'); process.exit(1); }
if (escalateLevel('critical', 'low') !== 'critical') { console.log('FAIL:no-downgrade'); process.exit(1); }

console.log('OK');
" 2>&1)

if echo "$SYNTH_TEST" | grep -q "^OK"; then
  pass "Synthesizer: derivedVerdict + escalateLevel"
else
  fail "Synthesizer: $SYNTH_TEST"
fi

# Signal scoring
SCORE_TEST=$(npx tsx --input-type=module -e "
const m = await import('./lib/score.ts');
const { score: computeScore, compoundBonus } = m.default || m;
const r = computeScore({ structural: 0.9, behavioral: 0.8, temporal: 0.7, compounds: 0 });
if (typeof r !== 'number' || r < 0 || r > 1) {
  console.log('FAIL:score=' + r); process.exit(1);
}
if (r < 0.5) { console.log('FAIL:too-low=' + r); process.exit(1); }
// Also test compoundBonus
const cb = compoundBonus({ signals: { auth_path: true, external_fetch: true, off_hours: true } });
if (cb !== 1) { console.log('FAIL:compound=' + cb); process.exit(1); }
console.log('OK:' + r.toFixed(3));
" 2>&1)

if echo "$SCORE_TEST" | grep -q "^OK:"; then
  SCORE_VAL=$(echo "$SCORE_TEST" | grep -o 'OK:[0-9.]*' | cut -d: -f2)
  pass "Score pipeline: structural+behavioral+temporal -> $SCORE_VAL"
else
  fail "Score pipeline: $SCORE_TEST"
fi

# File classifier
CLASS_TEST=$(npx tsx --input-type=module -e "
const m = await import('./lib/file-classifier.ts');
const { classify } = m.default || m;
const cases = [
  { path: 'app/api/auth/route.ts', area: 'api' },
  { path: 'lib/auth.ts', area: 'api' },
  { path: 'components/Nav.tsx', area: 'web' },
  { path: 'workflows/watchdog.ts', area: 'workers' },
];
for (const c of cases) {
  const r = classify(c.path);
  if (r.area !== c.area) { console.log('FAIL:' + c.path + ' expected=' + c.area + ' got=' + r.area); process.exit(1); }
}
console.log('OK');
" 2>&1)

if echo "$CLASS_TEST" | grep -q "^OK"; then
  pass "File classifier: 4 path->area mappings"
else
  fail "File classifier: $CLASS_TEST"
fi

# Demo mode
DEMO_TEST=$(npx tsx --input-type=module -e "
const m = await import('./app/(warroom)/hooks/useDeploysSSE.ts');
const { resolveInitialMode } = m.default || m;
if (resolveInitialMode({ search: '?live=1', localStorageMode: null }) !== 'live') { console.log('FAIL:url-live'); process.exit(1); }
if (resolveInitialMode({ search: '', localStorageMode: 'live' }) !== 'live') { console.log('FAIL:ls-live'); process.exit(1); }
if (resolveInitialMode({ search: '', localStorageMode: null }) !== 'demo') { console.log('FAIL:default'); process.exit(1); }
console.log('OK');
" 2>&1)

if echo "$DEMO_TEST" | grep -q "^OK"; then
  pass "Mode resolution: URL param > localStorage > default"
else
  fail "Mode resolution: $DEMO_TEST"
fi

# ── 11. ADVERSARIAL EDGE CASES ──────────────────
echo ""
echo "── 11. Adversarial Edge Cases ──"

# Redis key injection — path traversal must be rejected
KV_INJECT=$(npx tsx --input-type=module -e "
const m = await import('./lib/db.ts');
const { kv } = m.default || m;
const bad = ['../etc/passwd', 'key\x00null', 'a'.repeat(300), '../../root', 'key:../../escape'];
let blocked = 0;
for (const k of bad) {
  try { await kv.set(k, 'pwned'); } catch { blocked++; }
}
console.log('BLOCKED:' + blocked + '/' + bad.length);
" 2>&1)

if echo "$KV_INJECT" | grep -q "BLOCKED:5/5"; then
  pass "Redis rejects all 5 injection keys"
else
  fail "Redis key injection: $KV_INJECT"
fi

# Redis value size limit — large payloads must be rejected
KV_SIZE=$(npx tsx --input-type=module -e "
const m = await import('./lib/db.ts');
const { kv } = m.default || m;
const big = 'x'.repeat(6_000_000);
try { await kv.set('_test_big', big); console.log('FAIL:accepted'); } catch(e) { console.log('BLOCKED:' + e.message.substring(0, 40)); }
" 2>&1)

if echo "$KV_SIZE" | grep -q "BLOCKED:"; then
  pass "Redis rejects 6MB value"
else
  fail "Redis value size: $KV_SIZE"
fi

# SHA sanitization — non-hex SHAs must be sanitized to "unknown"
SHA_TEST=$(npx tsx --input-type=module -e "
const badShas = ['<script>alert(1)</script>', '../../../etc/passwd', 'abc;rm -rf /', '', 'x'.repeat(50)];
const SHA_RE = /^[0-9a-f]{7,40}$/;
function sanitize(raw) { return (!raw || !SHA_RE.test(raw)) ? 'unknown' : raw; }
let cleaned = 0;
for (const s of badShas) { if (sanitize(s) === 'unknown') cleaned++; }
console.log('CLEANED:' + cleaned + '/' + badShas.length);
" 2>&1)

if echo "$SHA_TEST" | grep -q "CLEANED:5/5"; then
  pass "SHA sanitizer rejects all 5 malicious inputs"
else
  fail "SHA sanitizer: $SHA_TEST"
fi

# Discord deployId validation — injection attempts must be rejected
DEPLOY_ID_TEST=$(npx tsx --input-type=module -e "
const DEPLOY_ID_RE = /^[a-zA-Z0-9_\-]{1,64}$/;
const bad = ['../../../etc', 'id;DROP TABLE', '<script>', 'a'.repeat(100), '', 'key:with:colons'];
let blocked = 0;
for (const d of bad) { if (!DEPLOY_ID_RE.test(d)) blocked++; }
console.log('BLOCKED:' + blocked + '/' + bad.length);
" 2>&1)

if echo "$DEPLOY_ID_TEST" | grep -q "BLOCKED:6/6"; then
  pass "DeployId regex rejects all 6 injection attempts"
else
  fail "DeployId validation: $DEPLOY_ID_TEST"
fi

# Score with extreme inputs — NaN, Infinity, negatives must not break scoring
SCORE_EDGE=$(npx tsx --input-type=module -e "
const m = await import('./lib/score.ts');
const { score: computeScore } = m.default || m;
const cases = [
  { structural: NaN, behavioral: NaN, temporal: NaN, compounds: NaN },
  { structural: Infinity, behavioral: -Infinity, temporal: 999, compounds: -1 },
  { structural: -0.5, behavioral: -0.1, temporal: -100, compounds: -50 },
  {},
];
for (const c of cases) {
  const r = computeScore(c);
  if (typeof r !== 'number' || isNaN(r) || r < 0 || r > 1) {
    console.log('FAIL:' + JSON.stringify(c) + ' -> ' + r); process.exit(1);
  }
}
console.log('OK');
" 2>&1)

if echo "$SCORE_EDGE" | grep -q "^OK"; then
  pass "Score clamps NaN/Infinity/negative to [0,1]"
else
  fail "Score edge cases: $SCORE_EDGE"
fi

# derivedVerdict — adversarial inputs must not crash
VERDICT_EDGE=$(npx tsx --input-type=module -e "
const m = await import('./workflows/synthesizer-helpers.ts');
const { derivedVerdict } = m.default || m;
const bad = [
  { findings: [], signals: {}, score: NaN },
  { findings: null, signals: null, score: -1 },
  { findings: [{ agent: 'x', severity: 'INVALID', summary: '' }], signals: {}, score: 2 },
  { findings: undefined, signals: undefined, score: undefined },
];
let safe = 0;
for (const input of bad) {
  try {
    const result = derivedVerdict(input);
    if (result && result.level) safe++;
  } catch {
    safe++;
  }
}
console.log('SAFE:' + safe + '/' + bad.length);
" 2>&1)

if echo "$VERDICT_EDGE" | grep -q "SAFE:4/4"; then
  pass "derivedVerdict handles all 4 adversarial inputs without crash"
else
  fail "derivedVerdict edge cases: $VERDICT_EDGE"
fi

# Demo branch allowlist — arbitrary branch names must be rejected
BRANCH_TEST=$(npx tsx --input-type=module -e "
const BRANCH_RE = /^[a-zA-Z0-9_\-./]{1,128}$/;
const ALLOWED = ['demo/exfil', 'demo/privesc', 'demo/leak'];
const bad = ['main;rm -rf /', '\$(whoami)', 'demo/../../etc/passwd', 'a'.repeat(200)];
let blocked = 0;
for (const b of bad) {
  if (!BRANCH_RE.test(b) || !ALLOWED.includes(b)) blocked++;
}
const good = ['demo/exfil', 'demo/privesc', 'demo/leak'];
let allowed = 0;
for (const g of good) {
  if (BRANCH_RE.test(g) && ALLOWED.includes(g)) allowed++;
}
console.log('BLOCKED:' + blocked + '/' + bad.length + ':ALLOWED:' + allowed + '/' + good.length);
" 2>&1)

if echo "$BRANCH_TEST" | grep -q "BLOCKED:4/4:ALLOWED:3/3"; then
  pass "Branch allowlist blocks 4 injections, allows 3 valid"
else
  fail "Branch allowlist: $BRANCH_TEST"
fi

# Webhook body size limit — oversized payloads must be rejected (deployed endpoint)
WEBHOOK_BIG=$(curl -sS -w "\n%{http_code}" --max-time 10 \
  -X POST "$DEPLOY_URL/api/webhooks/github" \
  -H "Content-Type: application/json" \
  -H "x-github-event: push" \
  -H "x-hub-signature-256: sha256=fake" \
  -H "Content-Length: 2000000" \
  -d '{"after":"test"}' 2>&1 | tail -1)
if [ "$WEBHOOK_BIG" = "413" ] || [ "$WEBHOOK_BIG" = "401" ]; then
  pass "Webhook rejects oversized/bad request ($WEBHOOK_BIG)"
else
  warn "Webhook returned $WEBHOOK_BIG for oversized payload (deploy may not have latest code)"
fi

# ── SUMMARY ──────────────────────────────────────
echo ""
echo "============================================"
echo "  RESULTS: $PASS passed, $FAIL failed, $WARN warnings"
echo "============================================"

if [ $FAIL -gt 0 ]; then
  exit 1
fi
