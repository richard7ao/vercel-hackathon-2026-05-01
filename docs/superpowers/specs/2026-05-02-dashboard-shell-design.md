# Bridge — Multi-page Dashboard Shell Spec

> **Companion to** `2026-05-01-bridge-design.md` and `2026-05-02-track1-fixes-design.md`. Those built the war room and fixed Track 1 compliance. This spec wraps the war room in a 5-tab dashboard shell so judges who click around see depth beyond the live demo.
>
> **Goal:** Turn the single-page war room into a 5-section dashboard (WAR ROOM / AGENT NETWORK / OPERATIONS / INTELLIGENCE / SYSTEMS), all sharing one SSE connection and one demo/live toggle. New tabs hand-rolled in the existing CSS war-room palette (no shadcn install, no rounded corners, no gradients). Every tab supports both demo and live data sources.
>
> **Non-goals:** No new backend workflows. No persistent storage beyond what already lives in KV. No auth — same single-tenant rehearsal-to-demo posture as the rest of Bridge. No mobile breakpoints beyond what the existing war room already has (the sidebar collapses, that's it).

## Source materials

- Multi-page template the user pulled in: `web-dashboard-design/` (v0-generated tactical-ops dashboard, MIT-licensed). Used as a structural reference only — its shadcn/orange-500/rounded styling is **not** adopted; only the sidebar+section pattern is.
- Locked aesthetic rules: project `CLAUDE.md` constraints table — black bg, mono fonts, single accent per state, no shadcn defaults.
- Existing war room: `app/(warroom)/page.tsx` and components.

## Verified preconditions (this machine, 2026-05-02)

- Existing war room renders at `/` via route group `(warroom)`. `useDeploysSSE` hook in `app/(warroom)/hooks/useDeploysSSE.ts:97` returns these fields (verified by reading the source):
  - `state`, `uptime`, `deploysAnalyzed`, `agentsStanding`, `mtta`, `budgetPct`
  - `deploys: { id, sha, author, pushed_at, score, tldr, files_changed }[]` (no per-deploy verdict/threats/hookEvents)
  - `agents: Record<agentName, { status, lines, steps, tokens, latency, finding }>` — keyed by name, current snapshot only
  - `feed: { ts, severity, kind, message }[]` — `kind` is hardcoded `'sys'` in the live-mode mapping (lines 195-200); to render Hook audit events we extend the mapping in T3
  - `threats: { id, severity, description, age_seconds, status }[]` — current snapshot only, no historical archive
  - `verdict: { level, summary, concerns, action, suggested_action, acknowledged } | null` — single latest verdict, has no `deploy_id` field in the live mapping but `liveState.verdict` (the raw event) does. T2 exposes `verdict.deploy_id` via context (one-line addition).
  - `mode`, `setMode`, `running`, `runDemo`, `reset`, `loopState`, `nextPlayInMs`, `activeDeploy`, `setActiveDeploy`, `setVerdict`
- Tailwind v4 active (`@import "tailwindcss"` in `globals.css`); custom CSS vars define the war-room palette.
- No shadcn/ui installed in `package.json`; constraint says do not add it.
- Template at `web-dashboard-design/` is a sibling folder, not imported. Stays in the repo as reference; **no code from it ships in production**.

## Live-mode honesty

The current SSE payload is **a current-snapshot stream, not a historical archive**. That shapes what the new tabs can show in live mode:

| Tab | Live mode shows | Live mode does NOT show |
|-----|-----------------|------------------------|
| AGENT NETWORK | current per-investigator status from `data.agents` map (one row per unique agent name in this session) | per-investigator run history across past deploys (would need new KV read) |
| OPERATIONS | `data.deploys[]` fed by SSE in this session | deploys that pre-date this session (would need new KV read) |
| INTELLIGENCE | current `data.threats[]` snapshot + Hook events filtered from `data.feed` | threat archive across past deploys (would need new KV read) |
| SYSTEMS | live `/api/health` pings + current `data.feed` errors | error history beyond current session (out of scope) |

Demo mode fills these gaps with `lib/demo-tabs.ts` fixtures (a much richer narrative). Live mode is honest about what's actually plumbed.

## Cuttable items (priority order if context exhausts)

**Never cut:** T0 (shell + context hoist), T1 (Agent Network — most direct mapping to Bridge story).

If forced to cut, in this order (cut top first):

1. T6 (Playwright browser coverage) — coverage hardening; existing tier3+tier4 grep tests still hold the line
2. T4 (Systems live mode + `/api/health` endpoint) — leave Systems all-green static even in "live" mode
3. T3 (Intelligence — fold the audit log into the existing WarRoom feed; drop the section)
4. T2 (Operations — replace card grid with a static table)

If we cut into T0 or T1, the multi-page submission is no longer differentiated — escalate before continuing.

---

## T0 — Foundation: shell + context

**Description:** Restructure the existing war room so the route is a sidebar shell, the SSE connection lives at the shell, and all sections consume it via context. No visual change to the war-room render — just a refactor that makes room for siblings.

### T0.1 — Move war room render into a section component

#### T0.1.1 — `app/(warroom)/sections/WarRoom.tsx`

**Description:** Cut the entire JSX tree currently in `app/(warroom)/page.tsx` (lines 16-85, the `WarRoom` component body) into a new `app/(warroom)/sections/WarRoom.tsx`. The new component receives no props — it pulls everything from `useDashboard()` (defined in T0.2). For now, leave `app/(warroom)/page.tsx` calling `useDeploysSSE()` directly and rendering `<WarRoom />` so the page still works mid-refactor.

**Verify:**

```bash
# tier1_build
npx tsc --noEmit
```

```bash
# tier2_simplify
# Informational only (project CLAUDE.md override). Files in scope:
# - app/(warroom)/sections/WarRoom.tsx (new)
# - app/(warroom)/page.tsx (modified to import WarRoom)
```

```bash
# tier3_unit
# Render the new section in isolation; assert nothing throws on import.
npx tsx --input-type=module -e "
import('./app/(warroom)/sections/WarRoom.tsx').then(m => {
  if (typeof m.WarRoom !== 'function' && typeof m.default !== 'function') throw new Error('WarRoom not exported');
  console.log('OK');
});
"
```

```bash
# tier4_integration
(npx next dev -p 3030 > /tmp/bridge-dev.log 2>&1 &) && \
for i in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15; do curl -fsS http://localhost:3030 > /dev/null 2>&1 && break; sleep 1; done && \
curl -fsS http://localhost:3030/ | grep -q 'BRIDGE' ; ec=$? ; \
pkill -f 'next dev.*3030' || true ; \
exit $ec
```

### T0.2 — Dashboard context

#### T0.2.1 — `app/(warroom)/contexts/DashboardContext.tsx`

**Description:** Provider that calls `useDeploysSSE()` once and exposes the entire return value plus `currentTab`/`setCurrentTab`. Hook: `useDashboard()` reads from `useContext`. Throws if used outside the provider. No memoization beyond what `useDeploysSSE` already does.

**Verify:**

```bash
# tier1_build
npx tsc --noEmit
```

```bash
# tier2_simplify
# Files in scope: app/(warroom)/contexts/DashboardContext.tsx (new)
```

```bash
# tier3_unit
npx tsx --input-type=module -e "
import('./app/(warroom)/contexts/DashboardContext.tsx').then(m => {
  if (typeof m.DashboardProvider !== 'function') throw new Error('DashboardProvider missing');
  if (typeof m.useDashboard !== 'function') throw new Error('useDashboard missing');
  console.log('OK');
});
"
```

```bash
# tier4_integration
# No standalone integration; context is exercised end-to-end by T0.3.1 + later sections.
echo 'covered_by=T0.3.1'
```

#### T0.2.2 — Refactor `WarRoom.tsx` to consume context

**Description:** Replace direct `useDeploysSSE()` call inside `WarRoom.tsx` with `useDashboard()`. Component now reads `data` from context. Visual output identical to T0.1.1.

**Requires:** T0.1.1, T0.2.1

**Verify:**

```bash
# tier1_build
npx tsc --noEmit
```

```bash
# tier2_simplify
# Files in scope: app/(warroom)/sections/WarRoom.tsx
```

```bash
# tier3_unit
# Same harness as T0.1.1 — module imports cleanly.
npx tsx --input-type=module -e "
import('./app/(warroom)/sections/WarRoom.tsx').then(m => { console.log('OK'); });
"
```

```bash
# tier4_integration
(npx next dev -p 3030 > /tmp/bridge-dev.log 2>&1 &) && \
for i in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15; do curl -fsS http://localhost:3030 > /dev/null 2>&1 && break; sleep 1; done && \
curl -fsS http://localhost:3030/ | grep -q 'BRIDGE' ; ec=$? ; \
pkill -f 'next dev.*3030' || true ; \
exit $ec
```

### T0.3 — Sidebar + shell

#### T0.3.1 — `app/(warroom)/components/Sidebar.tsx`

**Description:** Fixed-left, 280px wide expanded / 64px collapsed. Five nav buttons (WAR ROOM / AGENT NETWORK / OPERATIONS / INTELLIGENCE / SYSTEMS), each with a lucide icon and uppercase mono label. Active button: `var(--amber)` left-border + label color (no fill, no rounding); active button also gets `data-active="true"` attribute (asserted by T6.1.2 and T6.1.4 Playwright tests). Each button also has `data-tab="warroom|agents|ops|intel|systems"` for selectors. Bottom block when expanded: pulsing green dot + `SYSTEM ONLINE`, then three lines pulled from `useDashboard().data`: `UPTIME: <data.uptime formatted>`, `AGENTS: <Object.keys(data.agents).length> active`, `DEPLOYS: <data.deploysAnalyzed> analyzed`. Collapse toggle in header.

**Verify:**

```bash
# tier1_build
npx tsc --noEmit
```

```bash
# tier2_simplify
# Files in scope: app/(warroom)/components/Sidebar.tsx (new)
```

```bash
# tier3_unit
npx tsx --input-type=module -e "
import('./app/(warroom)/components/Sidebar.tsx').then(m => {
  if (typeof m.Sidebar !== 'function' && typeof m.default !== 'function') throw new Error('Sidebar not exported');
  console.log('OK');
});
"
```

```bash
# tier4_integration
# Covered by T0.3.2 page-level integration.
echo 'covered_by=T0.3.2'
```

#### T0.3.2 — Replace `app/(warroom)/page.tsx` with shell

**Description:** New `page.tsx` body: `<DashboardProvider>` wraps a flex row containing `<Sidebar />` + a right column. Right column renders `<WarRoom />` / `<AgentNetwork />` / `<Operations />` / `<Intelligence />` / `<Systems />` based on `currentTab`. WarRoom is the default tab on first paint. Scanlines + vignette divs stay at the page level (above all sections). On mount, the provider reads `new URLSearchParams(window.location.search).get('tab')` and initializes `currentTab` to one of `'warroom' | 'agents' | 'ops' | 'intel' | 'systems'` (default `'warroom'`). When `setCurrentTab` is called, the provider also calls `window.history.replaceState(null, '', '?tab=<id>')` so the URL stays in sync. This makes `?tab=agents` both direct-link and reflect-back, used by tier-4 SSR tests and T6 Playwright tests.

**Requires:** T0.2.2, T0.3.1

**Verify:**

```bash
# tier1_build
npx tsc --noEmit
```

```bash
# tier2_simplify
# Files in scope: app/(warroom)/page.tsx
```

```bash
# tier3_unit
# Page is exercised by tier4 — direct unit-test would need a React renderer.
echo 'covered_by=tier4'
```

```bash
# tier4_integration
(npx next dev -p 3030 > /tmp/bridge-dev.log 2>&1 &) && \
for i in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15; do curl -fsS http://localhost:3030 > /dev/null 2>&1 && break; sleep 1; done && \
html=$(curl -fsS http://localhost:3030/) ; \
echo "$html" | grep -q 'BRIDGE' && \
echo "$html" | grep -q 'WAR ROOM' && \
echo "$html" | grep -q 'AGENT NETWORK' && \
echo "$html" | grep -q 'OPERATIONS' && \
echo "$html" | grep -q 'INTELLIGENCE' && \
echo "$html" | grep -q 'SYSTEMS' ; ec=$? ; \
pkill -f 'next dev.*3030' || true ; \
exit $ec
```

#### T0.3.3 — Sidebar + shell CSS

**Description:** Append to `app/globals.css` (do not create a new stylesheet). New classes: `.dashboard-shell` (grid: sidebar / right-column), `.sidebar` (border-right `var(--line)`, bg `var(--bg-1)`), `.sidebar-nav-btn` with `[data-active="true"]` left-border accent, `.sidebar-status-block` (bottom block). Tokens reuse existing `--bg-*`, `--line-*`, `--amber`, `--green-dim`. **No new CSS variables.** **No `border-radius` > 0.** **No `linear-gradient`.**

**Requires:** T0.3.1

**Verify:**

```bash
# tier1_build
# Verify the appended CSS parses by running the next build's CSS pipeline through dev startup.
(npx next dev -p 3030 > /tmp/bridge-dev.log 2>&1 &) && \
for i in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15; do curl -fsS http://localhost:3030 > /dev/null 2>&1 && break; sleep 1; done && \
! grep -i 'css' /tmp/bridge-dev.log | grep -i 'error' ; ec=$? ; \
pkill -f 'next dev.*3030' || true ; \
exit $ec
```

```bash
# tier2_simplify
# Files in scope: app/globals.css (appended)
```

```bash
# tier3_unit
# Behavior assertion: forbidden patterns must not appear in the new sidebar block.
node -e "
const css = require('fs').readFileSync('app/globals.css', 'utf8');
const sidebarBlock = css.split('/* ========== Sidebar')[1] || '';
if (!sidebarBlock) throw new Error('sidebar block marker missing');
if (sidebarBlock.match(/border-radius:\s*[1-9]/)) throw new Error('rounded corners forbidden');
if (sidebarBlock.match(/linear-gradient/)) throw new Error('gradients forbidden');
if (sidebarBlock.match(/backdrop-filter/)) throw new Error('glassmorphism forbidden');
console.log('OK');
"
```

```bash
# tier4_integration
# Covered by T0.3.2 — sidebar renders inside the page integration test.
echo 'covered_by=T0.3.2'
```

### T0.4 — Demo data fixtures

#### T0.4.1 — `lib/demo-tabs.ts`

**Description:** Static demo data for the four new tabs. Exports: `DEMO_INVESTIGATORS` (4 investigator records), `DEMO_OPERATIONS` (8 past deploys with verdicts, durations, threat counts), `DEMO_THREAT_ARCHIVE` (12 threats spanning severity levels), `DEMO_SYSTEM_HEALTH` (4 services, all green, fake but plausible latencies). Tied to the Bridge narrative (history/dependency/diff investigator names; same verdict shape as live SSE).

**Verify:**

```bash
# tier1_build
npx tsc --noEmit
```

```bash
# tier2_simplify
# Files in scope: lib/demo-tabs.ts (new)
```

```bash
# tier3_unit
npx tsx --input-type=module -e "
import('./lib/demo-tabs.ts').then(m => {
  if (m.DEMO_INVESTIGATORS.length < 3) throw new Error('investigator roster too small');
  if (m.DEMO_OPERATIONS.length < 5) throw new Error('operations list too small');
  if (m.DEMO_THREAT_ARCHIVE.length < 8) throw new Error('threat archive too small');
  if (m.DEMO_SYSTEM_HEALTH.length !== 4) throw new Error('expected 4 services');
  console.log('OK');
});
"
```

```bash
# tier4_integration
# Pure data fixtures — no integration surface. Covered when sections consume them.
echo 'covered_by=T1.1.1+T2.1.1+T3.1.1+T4.1.2'
```

---

## T1 — Section: Agent Network

**Description:** Investigator roster. Demo mode reads from `DEMO_INVESTIGATORS`; live mode reads `agents[]` aggregated from `useDashboard().data`. Same component, branch on `mode`.

### T1.1 — Roster + tiles

#### T1.1.1 — `app/(warroom)/sections/AgentNetwork.tsx` (demo mode first)

**Description:** Layout: section header (title + subtitle), 4 stat tiles (TOTAL INVESTIGATORS / DISPATCHED / IDLE / FAILED-LAST-24H), roster table (id / role / status / runs / avg MTTA / last verdict / actions). Click a row → opens a right-side drawer with run history list. Drawer mounts with `data-drawer-open="true"` attribute on its root element (asserted by T6.1.6). Click on the dim overlay behind the drawer dismisses it (removes the element from the DOM). Demo mode uses `DEMO_INVESTIGATORS`; live-mode branch is a `// TODO: T1.1.2` for now.

**Requires:** T0.3.2, T0.4.1

**Verify:**

```bash
# tier1_build
npx tsc --noEmit
```

```bash
# tier2_simplify
# Files in scope: app/(warroom)/sections/AgentNetwork.tsx (new)
```

```bash
# tier3_unit
npx tsx --input-type=module -e "
import('./app/(warroom)/sections/AgentNetwork.tsx').then(m => {
  if (typeof m.AgentNetwork !== 'function' && typeof m.default !== 'function') throw new Error('AgentNetwork not exported');
  console.log('OK');
});
"
```

```bash
# tier4_integration
# After clicking the AGENT NETWORK nav button, the section content must render.
# Without a browser harness we assert via SSR: the page HTML contains the section's marker text.
(npx next dev -p 3030 > /tmp/bridge-dev.log 2>&1 &) && \
for i in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15; do curl -fsS http://localhost:3030 > /dev/null 2>&1 && break; sleep 1; done && \
curl -fsS 'http://localhost:3030/?tab=agents' | grep -qi 'INVESTIGATOR' ; ec=$? ; \
pkill -f 'next dev.*3030' || true ; \
exit $ec
```


#### T1.1.2 — Wire live mode

**Description:** Replace the live-mode TODO. Live mode reads `useDashboard().data.agents` (a `Record<agentName, InvestigatorEvent>` keyed by name — current snapshot per investigator). Build the roster as `Object.entries(data.agents).map(([name, ev]) => ({ id: name, role: name, status: ev.status, finding: ev.finding, last_action: ev.lines?.[ev.lines.length-1]?.text ?? '—' }))`. Stats tiles compute from the same map: TOTAL = `Object.keys(data.agents).length`, DISPATCHED = count where `status === 'dispatched' || 'investigating'`, IDLE = count where `status === 'idle'`, FAILED = count where `status === 'failed'`. When `mode === 'demo'` use `DEMO_INVESTIGATORS`; when `mode === 'live'` use the snapshot. Same render path.

**Requires:** T1.1.1

**Verify:**

```bash
# tier1_build
npx tsc --noEmit
```

```bash
# tier2_simplify
# Files in scope: app/(warroom)/sections/AgentNetwork.tsx
```

```bash
# tier3_unit
# Behavior: with a synthetic data.agents map, build the roster.
npx tsx --input-type=module -e "
import('./app/(warroom)/sections/AgentNetwork.tsx').then(m => {
  if (typeof m.buildRosterFromAgents !== 'function') throw new Error('buildRosterFromAgents not exported');
  const fake = { history: { status: 'complete', finding: { severity: 'low' }, lines: [{ ts: 't', text: 'done', cur: false }] }, diff: { status: 'investigating', finding: null, lines: [] } };
  const out = m.buildRosterFromAgents(fake);
  if (out.length !== 2) throw new Error('expected 2 rows, got ' + out.length);
  if (out.find(r => r.id === 'history').status !== 'complete') throw new Error('history status wrong');
  console.log('OK');
});
"
```

```bash
# tier4_integration
# Toggle to live mode, confirm section still renders without throwing.
(npx next dev -p 3030 > /tmp/bridge-dev.log 2>&1 &) && \
for i in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15; do curl -fsS http://localhost:3030 > /dev/null 2>&1 && break; sleep 1; done && \
curl -fsS 'http://localhost:3030/?tab=agents&live=1' > /dev/null ; ec=$? ; \
pkill -f 'next dev.*3030' || true ; \
exit $ec
```

#### T1.1.3 — Tile / table / drawer CSS

**Description:** Append to `globals.css`. New classes: `.section-shell` (max-width 1400, padding 24), `.section-header` (title + subtitle), `.tile-row` (4-column grid), `.tile` (1px line border, no fill, mono numerals), `.roster-table` (zebra via `tr:nth-child(odd) { background: var(--bg-1) }`, headers in `var(--fg-mute)`), `.drawer` (right-side fixed panel, slide-in 220ms, dismiss on overlay click). All tokens existing.

**Requires:** T1.1.1

**Verify:**

```bash
# tier1_build
(npx next dev -p 3030 > /tmp/bridge-dev.log 2>&1 &) && \
for i in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15; do curl -fsS http://localhost:3030 > /dev/null 2>&1 && break; sleep 1; done && \
! grep -i 'css' /tmp/bridge-dev.log | grep -i 'error' ; ec=$? ; \
pkill -f 'next dev.*3030' || true ; \
exit $ec
```

```bash
# tier2_simplify
# Files in scope: app/globals.css (appended)
```

```bash
# tier3_unit
node -e "
const css = require('fs').readFileSync('app/globals.css', 'utf8');
const block = css.split('/* ========== Section: Agent Network')[1] || '';
if (!block) throw new Error('agent network block marker missing');
if (block.match(/border-radius:\s*[1-9]/)) throw new Error('rounded corners forbidden');
if (block.match(/linear-gradient/)) throw new Error('gradients forbidden');
console.log('OK');
"
```

```bash
# tier4_integration
echo 'covered_by=T1.1.1'
```

---

## T2 — Section: Operations

**Description:** Past + active deploys. Demo mode = `DEMO_OPERATIONS`; live mode = `useDashboard().data.deploys` (full history, not just visible-on-timeline). Card grid layout matching the existing panel aesthetic.

### T2.1 — Card grid

#### T2.1.1 — `app/(warroom)/sections/Operations.tsx` (demo + live both)

**Description:** Top filter row (status pills: ALL / ACTIVE / CLEAR / SUSPENDED / FAILED). Card grid (3 cols at 1400+, 2 cols 1024+, 1 col below). Each card: sha+author header, verdict pill (green/amber/red), score, files-changed count, mini deploy timeline svg. Each card root has `data-deploy-id="<id>"` and renders the deploy's id text (so T6.1.4 Playwright can find it post-click). Demo mode = `DEMO_OPERATIONS`. Live mode = `data.deploys` with verdicts derived as: `verdict = data.verdict?.deploy_id === d.id ? data.verdict.level : 'pending'` (only the *current* verdict matches one deploy; others render as "pending"). Click on card → calls `setActiveDeploy(d.id)` from context and `setCurrentTab('warroom')`. The WarRoom shell adds `data-active-deploy="<id>"` to its outermost `.shell` div whenever `data.activeDeploy` is non-null (one-line addition in T0.1.1's WarRoom render). **Note:** in this session the live-mode card grid will typically show 1-3 deploys (only what's been pushed since SSE connected); demo mode shows the full 8-deploy narrative.

**Requires:** T0.3.2, T0.4.1

**Verify:**

```bash
# tier1_build
npx tsc --noEmit
```

```bash
# tier2_simplify
# Files in scope: app/(warroom)/sections/Operations.tsx (new)
```

```bash
# tier3_unit
npx tsx --input-type=module -e "
import('./app/(warroom)/sections/Operations.tsx').then(m => {
  if (typeof m.Operations !== 'function' && typeof m.default !== 'function') throw new Error('Operations not exported');
  if (typeof m.filterOperations !== 'function') throw new Error('filterOperations not exported');
  const ops = [{ id: 'd1', verdict: 'clear' }, { id: 'd2', verdict: 'critical' }, { id: 'd3', verdict: 'monitoring' }];
  if (m.filterOperations(ops, 'clear').length !== 1) throw new Error('clear filter wrong');
  if (m.filterOperations(ops, 'all').length !== 3) throw new Error('all filter wrong');
  console.log('OK');
});
"
```

```bash
# tier4_integration
(npx next dev -p 3030 > /tmp/bridge-dev.log 2>&1 &) && \
for i in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15; do curl -fsS http://localhost:3030 > /dev/null 2>&1 && break; sleep 1; done && \
curl -fsS 'http://localhost:3030/?tab=ops' | grep -qi 'OPERATIONS' ; ec=$? ; \
pkill -f 'next dev.*3030' || true ; \
exit $ec
```

#### T2.1.2 — Operations card CSS

**Description:** Append `.ops-grid`, `.ops-card` (1px line, hover → border `var(--amber)`), `.ops-card-header`, `.verdict-pill[data-level]` reusing existing color rules, `.ops-mini-timeline` (40px tall svg, identical to TimelineRow but compact). No rounded corners, no shadow except existing patterns.

**Requires:** T2.1.1

**Verify:**

```bash
# tier1_build
(npx next dev -p 3030 > /tmp/bridge-dev.log 2>&1 &) && \
for i in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15; do curl -fsS http://localhost:3030 > /dev/null 2>&1 && break; sleep 1; done && \
! grep -i 'css' /tmp/bridge-dev.log | grep -i 'error' ; ec=$? ; \
pkill -f 'next dev.*3030' || true ; \
exit $ec
```

```bash
# tier2_simplify
# Files in scope: app/globals.css (appended)
```

```bash
# tier3_unit
node -e "
const css = require('fs').readFileSync('app/globals.css', 'utf8');
const block = css.split('/* ========== Section: Operations')[1] || '';
if (!block) throw new Error('operations block marker missing');
if (block.match(/border-radius:\s*[1-9]/)) throw new Error('rounded corners forbidden');
if (block.match(/linear-gradient/)) throw new Error('gradients forbidden');
console.log('OK');
"
```

```bash
# tier4_integration
echo 'covered_by=T2.1.1'
```

---

## T3 — Section: Intelligence

**Description:** Threat archive + Hook audit log. Demo mode = `DEMO_THREAT_ARCHIVE` + scripted hook events. Live mode = current `data.threats[]` snapshot (no historical archive in this version) + Hook events filtered from `data.feed`. Adding a `'hook'` feed kind requires extending the live-mode mapping in `useDeploysSSE` (T3.0.1 below).

### T3.0 — Extend feed kind for Hook events

#### T3.0.1 — Pass through `kind` in live-mode feed mapping

**Description:** In `app/(warroom)/hooks/useDeploysSSE.ts:195-200`, the live-mode `feed` mapping hardcodes `kind: "sys" as const`. Replace with `kind: f.kind ?? "sys"` so Hook-related events (kind `'hook'`) pass through. Also update `lib/sse-events.ts` `FeedEvent` union to allow `kind: 'sys' | 'hook' | 'deploy' | 'agent' | 'verdict'`. No new event publishers — Hook handler in `app/api/discord/interactions/route.ts` (or wherever createHook resolves) emits feed events with `kind: 'hook'` when it already publishes "pause requested by X" / "resumed by X" lines.

**Verify:**

```bash
# tier1_build
npx tsc --noEmit
```

```bash
# tier2_simplify
# Files in scope: app/(warroom)/hooks/useDeploysSSE.ts, lib/sse-events.ts
```

```bash
# tier3_unit
# Behavior: a feed event published with kind 'hook' must round-trip through the live-mode mapping.
npx tsx --input-type=module -e "
import('./app/(warroom)/hooks/useDeploysSSE.ts').then(m => {
  const initial = m.initialState;
  const after = m.reducer(initial, { type: 'feed', ts: 't', severity: 'info', kind: 'hook', message: 'paused by sec-team' });
  if (after.feed[0].kind !== 'hook') throw new Error('hook kind dropped, got ' + after.feed[0].kind);
  console.log('OK');
});
"
```

```bash
# tier4_integration
# Smoke: existing war room still renders.
(npx next dev -p 3030 > /tmp/bridge-dev.log 2>&1 &) && \
for i in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15; do curl -fsS http://localhost:3030 > /dev/null 2>&1 && break; sleep 1; done && \
curl -fsS http://localhost:3030/ | grep -q 'BRIDGE' ; ec=$? ; \
pkill -f 'next dev.*3030' || true ; \
exit $ec
```

### T3.1 — Heatmap + archive + log

#### T3.1.1 — `app/(warroom)/sections/Intelligence.tsx` (demo + live)

**Description:** Three-region layout: severity heatmap left (12-bucket time x 4-row severity), threat archive table right (timestamp / id / severity / description / status), Hook audit log strip bottom (full-width, latest 20 entries from `data.feed.filter(f => f.kind === 'hook')`). Heatmap reuses `.heatmap-cell` styling from existing CSS. Hook audit reuses `.feed-line` styling. Demo mode source: `DEMO_THREAT_ARCHIVE` (12 threats, scripted) + the demo feed's hook entries. Live mode source: `data.threats` (current snapshot) + `data.feed.filter(f => f.kind === 'hook')`. Banner above the threat archive in live mode reads "current session — historical archive coming soon" so judges see the honesty.

**Requires:** T3.0.1

**Requires:** T0.3.2, T0.4.1

**Verify:**

```bash
# tier1_build
npx tsc --noEmit
```

```bash
# tier2_simplify
# Files in scope: app/(warroom)/sections/Intelligence.tsx (new)
```

```bash
# tier3_unit
npx tsx --input-type=module -e "
import('./app/(warroom)/sections/Intelligence.tsx').then(m => {
  if (typeof m.Intelligence !== 'function' && typeof m.default !== 'function') throw new Error('Intelligence not exported');
  if (typeof m.bucketThreats !== 'function') throw new Error('bucketThreats not exported');
  const fake = [{ ts: 1, severity: 'low' }, { ts: 1, severity: 'low' }, { ts: 5, severity: 'critical' }];
  const buckets = m.bucketThreats(fake, 0, 10, 5);
  if (buckets.length !== 5) throw new Error('expected 5 buckets, got ' + buckets.length);
  if (buckets[0].low !== 2) throw new Error('low bucket count wrong');
  if (buckets[2].critical !== 1) throw new Error('critical bucket count wrong');
  console.log('OK');
});
"
```

```bash
# tier4_integration
(npx next dev -p 3030 > /tmp/bridge-dev.log 2>&1 &) && \
for i in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15; do curl -fsS http://localhost:3030 > /dev/null 2>&1 && break; sleep 1; done && \
curl -fsS 'http://localhost:3030/?tab=intel' | grep -qi 'INTELLIGENCE' ; ec=$? ; \
pkill -f 'next dev.*3030' || true ; \
exit $ec
```

#### T3.1.2 — Intelligence layout CSS

**Description:** Append `.intel-grid` (`grid-template-columns: 1fr 1.2fr; grid-template-rows: 1fr 200px`), `.intel-heatmap-large` (extension of existing heatmap with bigger cells), `.intel-archive-table`, `.intel-audit-strip`. Reuses existing `.heatmap-cell`, `.feed-line`, `.sev-badge`. No new tokens.

**Requires:** T3.1.1

**Verify:**

```bash
# tier1_build
(npx next dev -p 3030 > /tmp/bridge-dev.log 2>&1 &) && \
for i in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15; do curl -fsS http://localhost:3030 > /dev/null 2>&1 && break; sleep 1; done && \
! grep -i 'css' /tmp/bridge-dev.log | grep -i 'error' ; ec=$? ; \
pkill -f 'next dev.*3030' || true ; \
exit $ec
```

```bash
# tier2_simplify
# Files in scope: app/globals.css (appended)
```

```bash
# tier3_unit
node -e "
const css = require('fs').readFileSync('app/globals.css', 'utf8');
const block = css.split('/* ========== Section: Intelligence')[1] || '';
if (!block) throw new Error('intelligence block marker missing');
if (block.match(/border-radius:\s*[1-9]/)) throw new Error('rounded corners forbidden');
if (block.match(/linear-gradient/)) throw new Error('gradients forbidden');
console.log('OK');
"
```

```bash
# tier4_integration
echo 'covered_by=T3.1.1'
```

---

## T4 — Section: Systems

**Description:** Service health + budget burn. Demo mode = `DEMO_SYSTEM_HEALTH` static; live mode polls `/api/health` every 10s.

### T4.1 — Health endpoint + section

#### T4.1.1 — `app/api/health/route.ts`

**Description:** GET endpoint. In parallel: ping KV (`${KV_REST_API_URL}/ping` with bearer), AI Gateway (`https://gateway.ai.vercel.app/v1/models`), Discord (`https://discord.com/api/v10/users/@me` with bot token), GitHub (`https://api.github.com/rate_limit` with token). Each ping has 3s timeout; on timeout/error returns `{ ok: false, error: 'timeout' | <message> }`. Response shape: `{ services: [{ name, ok, latency_ms, last_error?, extra? }] }`. Cache headers: `Cache-Control: no-store`. Wrap in try/catch so a missing env var returns `{ name, ok: false, last_error: 'env-not-configured' }` rather than 500.

**Verify:**

```bash
# tier1_build
npx tsc --noEmit
```

```bash
# tier2_simplify
# Files in scope: app/api/health/route.ts (new)
```

```bash
# tier3_unit
# Spin a tiny mock fetch and assert the route's handler aggregates correctly.
npx tsx --input-type=module -e "
import('./app/api/health/route.ts').then(async m => {
  if (typeof m.GET !== 'function') throw new Error('GET handler missing');
  const res = await m.GET(new Request('http://x/api/health'));
  const json = await res.json();
  if (!Array.isArray(json.services)) throw new Error('services not an array');
  if (json.services.length !== 4) throw new Error('expected 4 services, got ' + json.services.length);
  if (!json.services.every(s => typeof s.ok === 'boolean')) throw new Error('ok field wrong');
  console.log('OK');
});
"
```

```bash
# tier4_integration
(npx next dev -p 3030 > /tmp/bridge-dev.log 2>&1 &) && \
for i in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15; do curl -fsS http://localhost:3030 > /dev/null 2>&1 && break; sleep 1; done && \
curl -fsS http://localhost:3030/api/health | node -e "
let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{
  const j=JSON.parse(s);
  if(!Array.isArray(j.services))process.exit(1);
  if(j.services.length!==4)process.exit(1);
  process.exit(0);
});" ; ec=$? ; \
pkill -f 'next dev.*3030' || true ; \
exit $ec
```

#### T4.1.2 — `app/(warroom)/sections/Systems.tsx`

**Description:** 4 service tiles (KV / AI GATEWAY / DISCORD / GITHUB), each with status dot (green ok / red fail / amber slow >1.5s), latency in ms, last error text if any. Below: budget-burn ring (svg, percentage of `budgetPct` from context, amber if < 30%, red if < 10%). Bottom: recent errors feed (last 10 entries from `data.feed.filter(f => f.severity === 'critical' || f.severity === 'warn')`). Demo mode uses `DEMO_SYSTEM_HEALTH`; live mode fetches `/api/health` every 10s via `useEffect` interval (clear interval on unmount, but the section unmounts only on tab switch — we accept stale data when the user is on another tab).

**Requires:** T0.3.2, T0.4.1, T4.1.1

**Verify:**

```bash
# tier1_build
npx tsc --noEmit
```

```bash
# tier2_simplify
# Files in scope: app/(warroom)/sections/Systems.tsx (new)
```

```bash
# tier3_unit
npx tsx --input-type=module -e "
import('./app/(warroom)/sections/Systems.tsx').then(m => {
  if (typeof m.Systems !== 'function' && typeof m.default !== 'function') throw new Error('Systems not exported');
  if (typeof m.classifyLatency !== 'function') throw new Error('classifyLatency not exported');
  if (m.classifyLatency(50) !== 'ok') throw new Error('50ms should be ok');
  if (m.classifyLatency(2000) !== 'slow') throw new Error('2000ms should be slow');
  if (m.classifyLatency(null) !== 'fail') throw new Error('null should be fail');
  console.log('OK');
});
"
```

```bash
# tier4_integration
(npx next dev -p 3030 > /tmp/bridge-dev.log 2>&1 &) && \
for i in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15; do curl -fsS http://localhost:3030 > /dev/null 2>&1 && break; sleep 1; done && \
curl -fsS 'http://localhost:3030/?tab=systems' | grep -qi 'KV' ; ec=$? ; \
pkill -f 'next dev.*3030' || true ; \
exit $ec
```

#### T4.1.3 — Systems CSS

**Description:** Append `.systems-grid`, `.service-tile` (1px line border, no fill, status dot top-right), `.budget-ring` (svg-only, no css gradient — solid stroke amber/red), `.recent-errors-feed` (reuses `.feed-line` styles). All tokens existing.

**Requires:** T4.1.2

**Verify:**

```bash
# tier1_build
(npx next dev -p 3030 > /tmp/bridge-dev.log 2>&1 &) && \
for i in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15; do curl -fsS http://localhost:3030 > /dev/null 2>&1 && break; sleep 1; done && \
! grep -i 'css' /tmp/bridge-dev.log | grep -i 'error' ; ec=$? ; \
pkill -f 'next dev.*3030' || true ; \
exit $ec
```

```bash
# tier2_simplify
# Files in scope: app/globals.css (appended)
```

```bash
# tier3_unit
node -e "
const css = require('fs').readFileSync('app/globals.css', 'utf8');
const block = css.split('/* ========== Section: Systems')[1] || '';
if (!block) throw new Error('systems block marker missing');
if (block.match(/border-radius:\s*[1-9]/)) throw new Error('rounded corners forbidden');
if (block.match(/linear-gradient/)) throw new Error('gradients forbidden');
console.log('OK');
"
```

```bash
# tier4_integration
echo 'covered_by=T4.1.2'
```

---

## T5 — Polish + integration

**Description:** Cross-section concerns. Verify the toggle flips every section, the SSE survives tab switches, no aesthetic regression slipped in.

### T5.1 — Cross-tab integration

#### T5.1.1 — Demo/Live toggle parity

**Description:** Confirm the existing `TopBar` Demo/Live toggle is the single source of `mode` for every section. Remove any per-section local mode state if it crept in. Visual inspection only — no new code unless drift is found.

**Requires:** T1.1.2, T2.1.1, T3.1.1, T4.1.2

**Verify:**

```bash
# tier1_build
npx tsc --noEmit
```

```bash
# tier2_simplify
# Files in scope: any section file with stray local mode state (expected: none).
```

```bash
# tier3_unit
# Behavior: every section component imports useDashboard, none calls useDeploysSSE directly.
node -e "
const fs = require('fs');
const path = require('path');
const sections = ['WarRoom','AgentNetwork','Operations','Intelligence','Systems'];
for (const s of sections) {
  const p = 'app/(warroom)/sections/' + s + '.tsx';
  const src = fs.readFileSync(p, 'utf8');
  if (src.match(/useDeploysSSE\s*\(/)) throw new Error(s + ' calls useDeploysSSE directly — must use useDashboard');
  if (!src.match(/useDashboard\s*\(/)) throw new Error(s + ' does not call useDashboard');
}
console.log('OK');
"
```

```bash
# tier4_integration
echo 'covered_by=T5.1.2'
```

#### T5.1.2 — SSE persistence across tab switches

**Description:** Manual + automated check. Open the page, switch from WAR ROOM to OPERATIONS to AGENT NETWORK back to WAR ROOM. The deploy timeline must continue updating (no remount). Test asserts: when `currentTab` changes, `useDashboard().data.deploysAnalyzed` count must not reset to 0.

**Requires:** T5.1.1

**Verify:**

```bash
# tier1_build
npx tsc --noEmit
```

```bash
# tier2_simplify
# No source changes expected; verification stage only.
```

```bash
# tier3_unit
# Static check: shell renders provider exactly once at the top level.
node -e "
const fs = require('fs');
const src = fs.readFileSync('app/(warroom)/page.tsx', 'utf8');
const matches = src.match(/<DashboardProvider/g) || [];
if (matches.length !== 1) throw new Error('expected exactly 1 DashboardProvider mount, got ' + matches.length);
console.log('OK');
"
```

```bash
# tier4_integration
# Headless smoke: the page HTML must contain only one <DashboardProvider> instance, and
# every section's marker must coexist behind tab switches (all rendered in one tree, swap visibility).
(npx next dev -p 3030 > /tmp/bridge-dev.log 2>&1 &) && \
for i in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15; do curl -fsS http://localhost:3030 > /dev/null 2>&1 && break; sleep 1; done && \
html=$(curl -fsS http://localhost:3030/) && \
echo "$html" | grep -q 'BRIDGE' ; ec=$? ; \
pkill -f 'next dev.*3030' || true ; \
exit $ec
```

#### T5.1.3 — Aesthetic audit

**Description:** Final pass: no `border-radius` > 0, no `linear-gradient`, no `backdrop-filter`, no `shadcn` imports, no `bg-orange-500` or other tailwind utility colors leaking from the template. Inspection runs over all new files (`app/(warroom)/sections/*`, `app/(warroom)/components/Sidebar.tsx`, `app/(warroom)/contexts/DashboardContext.tsx`, `app/api/health/route.ts`, `lib/demo-tabs.ts`) plus the appended `globals.css` blocks.

**Requires:** T5.1.2

**Verify:**

```bash
# tier1_build
npx tsc --noEmit
```

```bash
# tier2_simplify
# All section + sidebar files in scope (final review).
```

```bash
# tier3_unit
node -e "
const fs = require('fs');
const path = require('path');
const targets = [
  'app/(warroom)/sections/WarRoom.tsx',
  'app/(warroom)/sections/AgentNetwork.tsx',
  'app/(warroom)/sections/Operations.tsx',
  'app/(warroom)/sections/Intelligence.tsx',
  'app/(warroom)/sections/Systems.tsx',
  'app/(warroom)/components/Sidebar.tsx',
  'app/(warroom)/contexts/DashboardContext.tsx',
];
for (const t of targets) {
  const src = fs.readFileSync(t, 'utf8');
  if (src.match(/from\s+['\"]@\/components\/ui\//)) throw new Error(t + ' imports shadcn');
  if (src.match(/bg-orange-/)) throw new Error(t + ' uses bg-orange-* utility');
  if (src.match(/rounded-(?!none|0)/)) throw new Error(t + ' uses rounded-* utility (forbidden — only rounded-none/0 allowed)');
  if (src.match(/backdrop-blur/)) throw new Error(t + ' uses backdrop-blur (glassmorphism forbidden)');
}
const css = fs.readFileSync('app/globals.css', 'utf8');
const newBlocks = ['Sidebar','Section: Agent Network','Section: Operations','Section: Intelligence','Section: Systems'];
for (const marker of newBlocks) {
  const idx = css.indexOf(marker);
  if (idx < 0) throw new Error('css block missing: ' + marker);
  const block = css.slice(idx, idx + 4000);
  if (block.match(/linear-gradient/)) throw new Error(marker + ' uses linear-gradient');
  if (block.match(/border-radius:\s*[1-9]/)) throw new Error(marker + ' uses border-radius > 0');
}
console.log('OK');
"
```

```bash
# tier4_integration
# Same as T5.1.2 — homepage renders without console errors.
(npx next dev -p 3030 > /tmp/bridge-dev.log 2>&1 &) && \
for i in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15; do curl -fsS http://localhost:3030 > /dev/null 2>&1 && break; sleep 1; done && \
curl -fsS http://localhost:3030/ > /dev/null && \
! grep -i 'error' /tmp/bridge-dev.log | grep -vi 'warning' ; ec=$? ; \
pkill -f 'next dev.*3030' || true ; \
exit $ec
```

---

## T6 — End-to-end browser coverage

**Description:** Plug the four gaps the tier4 SSR-grep tests can't reach: click-driven nav, SSE persistence across tab switches, Operations card → WarRoom drill-down, Systems polling interval. Real Playwright tests, runnable in CI, deterministic.

### T6.1 — Playwright setup + e2e specs

#### T6.1.1 — Install Playwright + init

**Description:** Add `@playwright/test` as a devDependency (`npm install --save-dev @playwright/test`). Run `npx playwright install chromium` to fetch the browser binary. Create `playwright.config.ts` with: `testDir: './tests/e2e'`, `webServer: { command: 'npx next dev -p 3030', url: 'http://localhost:3030', reuseExistingServer: !process.env.CI, timeout: 60_000 }`, `use: { baseURL: 'http://localhost:3030', trace: 'on-first-retry' }`, single project (chromium). Add a top-level `package.json` script `"test:e2e": "playwright test"`.

**Verify:**

```bash
# tier1_build
npx tsc --noEmit && test -f playwright.config.ts && grep -q '"@playwright/test"' package.json
```

```bash
# tier2_simplify
# Files in scope: package.json, playwright.config.ts (new)
```

```bash
# tier3_unit
# Behavior: playwright config parses and exports a test config object.
node -e "
const cfg = require('./playwright.config.ts');
const c = cfg.default ?? cfg;
if (!c.webServer || !c.webServer.command) throw new Error('webServer missing');
if (c.webServer.url !== 'http://localhost:3030') throw new Error('webServer.url wrong');
console.log('OK');
" 2>&1 || npx tsx --input-type=module -e "
import('./playwright.config.ts').then(m => {
  const c = m.default;
  if (!c.webServer) throw new Error('webServer missing');
  console.log('OK');
});
"
```

```bash
# tier4_integration
# Playwright is installed; running a no-op test list confirms the runner boots.
npx playwright test --list > /tmp/pw-list.log 2>&1 ; ec=$? ; \
test $ec -eq 0 || (cat /tmp/pw-list.log; exit 1)
```

#### T6.1.2 — `tests/e2e/sidebar-nav.spec.ts`

**Description:** Browser test: load `/`, assert sidebar has 5 buttons. Click each (WAR ROOM / AGENT NETWORK / OPERATIONS / INTELLIGENCE / SYSTEMS), assert the right section's marker text appears (`BRIDGE`, `INVESTIGATOR`, `OPERATIONS`, `INTELLIGENCE`, `KV`). Per click, also assert URL query param updates to `?tab=warroom|agents|ops|intel|systems` respectively (T0.3.2 writes this via `history.replaceState`).

**Requires:** T6.1.1, T0.3.2

**Verify:**

```bash
# tier1_build
npx tsc --noEmit
```

```bash
# tier2_simplify
# Files in scope: tests/e2e/sidebar-nav.spec.ts (new)
```

```bash
# tier3_unit
# Static check: the spec file references all 5 sections.
node -e "
const src = require('fs').readFileSync('tests/e2e/sidebar-nav.spec.ts', 'utf8');
for (const t of ['WAR ROOM','AGENT NETWORK','OPERATIONS','INTELLIGENCE','SYSTEMS']) {
  if (!src.includes(t)) throw new Error('spec missing label: ' + t);
}
console.log('OK');
"
```

```bash
# tier4_integration
npx playwright test tests/e2e/sidebar-nav.spec.ts --reporter=list
```

#### T6.1.3 — `tests/e2e/sse-persistence.spec.ts`

**Description:** Browser test: load `/?live=0` (demo mode), wait for `data.deploysAnalyzed > 0` (visible in sidebar status block as `DEPLOYS: <n> analyzed`). Capture the count `before`. Click AGENT NETWORK → wait 200ms → click OPERATIONS → wait 200ms → click WAR ROOM. Capture count `after`. Assert `after >= before` (counter must not reset, and demo timer keeps ticking across tabs). Hard fail if `after < before`.

**Requires:** T6.1.1, T5.1.2

**Verify:**

```bash
# tier1_build
npx tsc --noEmit
```

```bash
# tier2_simplify
# Files in scope: tests/e2e/sse-persistence.spec.ts (new)
```

```bash
# tier3_unit
node -e "
const src = require('fs').readFileSync('tests/e2e/sse-persistence.spec.ts', 'utf8');
if (!src.match(/deploysAnalyzed|DEPLOYS:/)) throw new Error('spec must read deploys counter');
if (!src.match(/expect.*after.*before|after\s*>=\s*before/)) throw new Error('spec must assert counter monotonicity');
console.log('OK');
"
```

```bash
# tier4_integration
npx playwright test tests/e2e/sse-persistence.spec.ts --reporter=list
```

#### T6.1.4 — `tests/e2e/operations-drilldown.spec.ts`

**Description:** Browser test: load `/?tab=ops` (demo mode). Assert at least 5 deploy cards rendered (each has `data-deploy-id`). Capture the second card's `data-deploy-id` attribute. Click it. Assert WAR ROOM is now active (URL shows `?tab=warroom`, sidebar's WAR ROOM button has `[data-active="true"]`). Assert the WarRoom shell's outer `.shell` element now has `data-active-deploy` matching the captured id.

**Requires:** T6.1.1, T2.1.1

**Verify:**

```bash
# tier1_build
npx tsc --noEmit
```

```bash
# tier2_simplify
# Files in scope: tests/e2e/operations-drilldown.spec.ts (new)
```

```bash
# tier3_unit
node -e "
const src = require('fs').readFileSync('tests/e2e/operations-drilldown.spec.ts', 'utf8');
if (!src.match(/\\?tab=ops/)) throw new Error('spec must direct-link to ops tab');
if (!src.match(/data-active|WAR ROOM/)) throw new Error('spec must assert WAR ROOM activates');
console.log('OK');
"
```

```bash
# tier4_integration
npx playwright test tests/e2e/operations-drilldown.spec.ts --reporter=list
```

#### T6.1.5 — `tests/e2e/systems-polling.spec.ts`

**Description:** Browser test: load `/?tab=systems&live=1`. Use `page.route('**/api/health', ...)` to intercept and count calls. Wait 12 seconds. Assert at least 2 calls were made (initial + one 10s interval tick). Assert the 4 service tiles (KV / AI GATEWAY / DISCORD / GITHUB) all rendered with status indicators.

**Requires:** T6.1.1, T4.1.2

**Verify:**

```bash
# tier1_build
npx tsc --noEmit
```

```bash
# tier2_simplify
# Files in scope: tests/e2e/systems-polling.spec.ts (new)
```

```bash
# tier3_unit
node -e "
const src = require('fs').readFileSync('tests/e2e/systems-polling.spec.ts', 'utf8');
if (!src.match(/page\.route.*\/api\/health/)) throw new Error('spec must intercept /api/health');
if (!src.match(/>=?\s*2|toBeGreaterThanOrEqual\(2\)/)) throw new Error('spec must assert >= 2 calls');
console.log('OK');
"
```

```bash
# tier4_integration
npx playwright test tests/e2e/systems-polling.spec.ts --reporter=list
```

#### T6.1.6 — `tests/e2e/agent-drawer.spec.ts`

**Description:** Browser test: load `/?tab=agents`. Click the first roster row. Assert drawer slides in from the right (`[data-drawer-open="true"]` exists). Click the overlay (anywhere outside the drawer). Assert drawer dismisses (`[data-drawer-open="true"]` no longer in DOM).

**Requires:** T6.1.1, T1.1.1

**Verify:**

```bash
# tier1_build
npx tsc --noEmit
```

```bash
# tier2_simplify
# Files in scope: tests/e2e/agent-drawer.spec.ts (new)
```

```bash
# tier3_unit
node -e "
const src = require('fs').readFileSync('tests/e2e/agent-drawer.spec.ts', 'utf8');
if (!src.match(/data-drawer-open/)) throw new Error('spec must assert drawer-open data attribute');
if (!src.match(/click.*overlay|click.*outside/i)) throw new Error('spec must dismiss via overlay click');
console.log('OK');
"
```

```bash
# tier4_integration
npx playwright test tests/e2e/agent-drawer.spec.ts --reporter=list
```

#### T6.1.7 — Aggregate e2e suite

**Description:** Add a single `npm run test:e2e` invocation that runs all five specs serially (CI gate). No new spec file — just confirm `npx playwright test` exits 0 with all 5 specs in the suite.

**Requires:** T6.1.2, T6.1.3, T6.1.4, T6.1.5, T6.1.6

**Verify:**

```bash
# tier1_build
npx tsc --noEmit
```

```bash
# tier2_simplify
# No source changes — verification only.
```

```bash
# tier3_unit
# Confirm playwright sees all 5 specs.
npx playwright test --list 2>&1 | tee /tmp/pw-list.log | grep -c 'spec.ts' > /tmp/pw-count
test "$(cat /tmp/pw-count)" -ge 5 || (cat /tmp/pw-list.log; exit 1)
```

```bash
# tier4_integration
# Full run — all 5 specs must pass.
npx playwright test --reporter=list
```

---

## Summary

- **5 sections** rendered from one shell, one SSE connection, one demo/live toggle.
- **Hand-rolled** in existing CSS war-room palette — no shadcn, no rounded, no gradients.
- **Both modes** specced for every tab. Live mode reuses the existing SSE payload (no new backend writes); only `/api/health` is new.
- **Coverage:** tier3 unit tests for behavior + grep guards; tier4 SSR HTML markers; **T6** Playwright e2e for click-driven flows, SSE persistence, drill-down, polling, drawer dismiss.
- **Layered cuts:** if context exhausts, drop T6 → Systems live → Intelligence → Operations in that order. T0 + T1 are non-negotiable.
- **Aesthetic gate** at T5.1.3 enforces the locked palette across every new file via grep.
