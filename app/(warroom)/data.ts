export const SECOND = 1000;
export const MINUTE = 60 * SECOND;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

export type Deploy = {
  id: string;
  sha: string;
  author: string;
  pushed_at: string;
  tldr: string;
  score: number;
  files_changed: string[];
};

export type FeedEntry = {
  ts: string;
  severity: 'info' | 'warn' | 'critical';
  kind: 'sys' | 'bot' | 'msg';
  author?: string;
  message: string;
};

export type AgentDef = {
  key: string;
  name: string;
  role: string;
  idx: string;
};

export type AgentLine = {
  ts: string;
  text: string;
  cur: boolean;
};

export type AgentFinding = {
  severity: 'low' | 'medium' | 'high' | 'critical' | 'gray';
  summary: string;
};

export type AgentState = {
  status: 'idle' | 'dispatched' | 'investigating' | 'complete' | 'failed';
  lines: AgentLine[];
  steps: number;
  tokens: number;
  latency: string;
  tool?: string;
  finding?: AgentFinding;
};

export type Threat = {
  id: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  age_seconds: number;
  status: 'open' | 'resolved';
  deploy_ref?: string;
  file?: string;
  justAdded?: boolean;
};

export type Verdict = {
  level: string;
  summary: string;
  concerns: string[];
  action: string;
  /** Full workflow deploy id — required for live `POST /api/demo/resume`. */
  deploy_id?: string;
  deploy_id_short?: string;
  suggested_action?: string;
  acknowledged?: boolean;
  acknowledged_by?: string;
  action_taken?: string;
};

export type StatusState = 'all_clear' | 'monitoring' | 'anomaly' | 'critical';

export const STATUS_LABELS: Record<StatusState, string> = {
  all_clear: 'ALL CLEAR',
  monitoring: 'MONITORING',
  anomaly: 'ANOMALY DETECTED',
  critical: 'CRITICAL',
};

export const AGENT_DEFS: AgentDef[] = [
  { key: 'trace', name: 'TRACE', role: 'INSPECTOR AGENT · OTLP', idx: '01' },
  { key: 'runtime', name: 'RUNTIME', role: 'INSPECTOR AGENT · METRICS', idx: '02' },
  { key: 'history', name: 'HISTORY', role: 'INSPECTOR AGENT · GIT', idx: '03' },
  { key: 'dependency', name: 'DEPENDENCY', role: 'INSPECTOR AGENT · GRAPH', idx: '04' },
  { key: 'diff', name: 'DIFF', role: 'INSPECTOR AGENT · AST', idx: '05' },
];

export const HEATMAP_FILES = [
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

function makeInitialDeploys(): Deploy[] {
  const NOW = Date.now();
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
  const out: Deploy[] = [];
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

function makeHeatmap(): number[][] {
  const rows = HEATMAP_FILES.length;
  const cols = 30;
  const grid: number[][] = [];
  for (let r = 0; r < rows; r++) {
    const row: number[] = [];
    const baseline = Math.random() * 0.18;
    for (let c = 0; c < cols; c++) {
      let v = baseline + Math.random() * 0.18;
      if (Math.random() < 0.04) v = 0.45 + Math.random() * 0.35;
      row.push(Math.min(0.85, v));
    }
    grid.push(row);
  }
  return grid;
}

export const INITIAL_DEPLOYS = makeInitialDeploys();
export const INITIAL_HEATMAP = makeHeatmap();

export const INITIAL_THREATS: Threat[] = [
  {
    id: 'th_001',
    severity: 'medium',
    description: 'CVE-2025-3827  unpatched in `next` (1 minor behind)',
    age_seconds: 14 * DAY / SECOND,
    status: 'open',
  },
];

export const INITIAL_FEED: FeedEntry[] = [
  { ts: '03:31:04', severity: 'info', kind: 'sys', message: 'Bridge online · monitoring repo `acme/control-plane`' },
  { ts: '03:31:04', severity: 'info', kind: 'sys', message: 'SSE channel established · 5 agents standing by' },
  { ts: '03:33:12', severity: 'info', kind: 'msg', author: 'ana-w', message: 'shipping the queue tidy now' },
  { ts: '03:33:48', severity: 'info', kind: 'bot', message: 'deploy `dep_046` analyzed · score 0.11 · benign' },
  { ts: '03:36:21', severity: 'info', kind: 'msg', author: 'k-chen', message: 'docs change going out, fyi' },
  { ts: '03:36:54', severity: 'info', kind: 'bot', message: 'deploy `dep_047` analyzed · score 0.04 · benign' },
  { ts: '03:38:09', severity: 'info', kind: 'sys', message: '12 days uptime · 47 deploys analyzed · 0 incidents' },
];

export function initAgents(): Record<string, AgentState> {
  const o: Record<string, AgentState> = {};
  AGENT_DEFS.forEach(a => {
    o[a.key] = { status: 'idle', lines: [], steps: 0, tokens: 0, latency: '—' };
  });
  return o;
}

export function nowTs(offsetMs = 0): string {
  return new Date(Date.now() + offsetMs).toISOString().slice(11, 19);
}

export function fmtUptime(sec: number): string {
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (d > 0) return `${d}d ${h.toString().padStart(2, '0')}h`;
  return `${h}h ${m}m`;
}
