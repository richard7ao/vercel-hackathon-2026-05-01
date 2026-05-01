/* eslint-disable */
/* global React */

// ============================================================
// MOCK DATA — initial state for the calm war room
// ============================================================

const NOW = Date.now();
const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

// generate 47 historical deploys spread across last 30 days, mostly low risk
function makeInitialDeploys() {
  const authors = ['ana-w', 'k-chen', 'd-park', 'm-rivera', 'j-singh', 't-okafor', 's-lin', 'r-gomez'];
  const summaries = [
    'bump deps + minor tidy',
    'fix flaky test in queue',
    'new feature flag scaffolding',
    'docs: clarify webhook retries',
    'reduce p95 on /search',
    'extract metrics emitter',
    'remove dead import',
    'guard against null user',
    'tweak rate limit bucket',
    'update copy on dashboard',
    'add tracing to job runner',
    'cache image thumbnails',
    'lint pass',
    'rotate read replica',
    'noop refactor of util',
  ];
  const out = [];
  for (let i = 0; i < 47; i++) {
    const t = NOW - (29.5 - i * (29.5 / 47)) * DAY + (Math.random() - 0.5) * 6 * HOUR;
    const score = Math.random() < 0.84
      ? Math.random() * 0.28
      : Math.random() < 0.7
        ? 0.3 + Math.random() * 0.28
        : 0.6 + Math.random() * 0.22;
    out.push({
      id: 'dep_' + i.toString().padStart(3, '0'),
      sha: Math.random().toString(16).slice(2, 9),
      author: authors[Math.floor(Math.random() * authors.length)],
      pushed_at: new Date(t).toISOString(),
      tldr: summaries[Math.floor(Math.random() * summaries.length)],
      score,
      files_changed: [],
    });
  }
  return out.sort((a, b) => +new Date(a.pushed_at) - +new Date(b.pushed_at));
}

const INITIAL_DEPLOYS = makeInitialDeploys();

const HEATMAP_FILES = [
  'app/api/auth/[...]/route.ts',
  'lib/auth.ts',
  'lib/db/queries.ts',
  'app/(app)/dashboard.tsx',
  'lib/billing/stripe.ts',
  'app/api/admin/export.ts',
  'lib/queue/runner.ts',
  'components/Nav.tsx',
  'app/api/webhooks/in.ts',
  'lib/cache/redis.ts',
  'middleware.ts',
  'lib/observability/trace.ts',
];

// 12 rows × 30 cols; values 0..1
function makeHeatmap() {
  const rows = HEATMAP_FILES.length;
  const cols = 30;
  const grid = [];
  for (let r = 0; r < rows; r++) {
    const row = [];
    const baseline = Math.random() * 0.18;
    for (let c = 0; c < cols; c++) {
      let v = baseline + Math.random() * 0.18;
      // a few hotspots
      if (Math.random() < 0.04) v = 0.45 + Math.random() * 0.35;
      row.push(Math.min(0.85, v));
    }
    grid.push(row);
  }
  return grid;
}

const INITIAL_HEATMAP = makeHeatmap();

const INITIAL_THREATS = [
  {
    id: 'th_001',
    severity: 'medium',
    description: 'CVE-2025-3827  unpatched in `next` (1 minor behind)',
    age_seconds: 14 * DAY / SECOND,
    status: 'open',
  },
];

// initial calm feed
const INITIAL_FEED = [
  { ts: '03:31:04', severity: 'info', kind: 'sys',  message: 'Bridge online · monitoring repo `acme/control-plane`' },
  { ts: '03:31:04', severity: 'info', kind: 'sys',  message: 'SSE channel established · 5 agents standing by' },
  { ts: '03:33:12', severity: 'info', kind: 'msg',  author: 'ana-w', message: 'shipping the queue tidy now' },
  { ts: '03:33:48', severity: 'info', kind: 'bot',  message: 'deploy `dep_046` analyzed · score 0.11 · benign' },
  { ts: '03:36:21', severity: 'info', kind: 'msg',  author: 'k-chen', message: 'docs change going out, fyi' },
  { ts: '03:36:54', severity: 'info', kind: 'bot',  message: 'deploy `dep_047` analyzed · score 0.04 · benign' },
  { ts: '03:38:09', severity: 'info', kind: 'sys',  message: '12 days uptime · 47 deploys analyzed · 0 incidents' },
];

const AGENT_DEFS = [
  { key: 'trace',      name: 'TRACE',      role: 'INSPECTOR · OTLP',      idx: '01' },
  { key: 'runtime',    name: 'RUNTIME',    role: 'INSPECTOR · METRICS',   idx: '02' },
  { key: 'history',    name: 'HISTORY',    role: 'INSPECTOR · GIT',       idx: '03' },
  { key: 'dependency', name: 'DEPENDENCY', role: 'INSPECTOR · GRAPH',     idx: '04' },
  { key: 'diff',       name: 'DIFF',       role: 'INSPECTOR · AST',       idx: '05' },
];

window.__bridgeData = {
  INITIAL_DEPLOYS,
  INITIAL_HEATMAP,
  INITIAL_THREATS,
  INITIAL_FEED,
  HEATMAP_FILES,
  AGENT_DEFS,
  NOW, SECOND, MINUTE, HOUR, DAY,
};
