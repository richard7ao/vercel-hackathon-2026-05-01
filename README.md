<p align="center">
  <img src="docs/bridge-header.svg" alt="BRIDGE" width="100%" />
</p>

<h1 align="center">B R I D G E</h1>
<h3 align="center">Multi-Agent Deploy Security War Room</h3>

<p align="center">
  <em>A durable multi-agent system that watches every deploy to a <strong>mock core-banking monolith</strong>, scores it for risk, dispatches five investigator agents in parallel, synthesizes a verdict, and pauses the pipeline for human acknowledgment — all on Vercel's Workflow Development Kit (WDK). <strong>Connected to GitHub</strong> (webhooks + ingest) and <strong>Discord</strong> (verdict embeds + button interactions that <code>resumeHook</code> the workflow).</em>
</p>

<p align="center">
  <a href="https://vercel-hackathon-2026-05-01.vercel.app"><strong>Live Demo</strong></a> ·
  <a href="https://github.com/richard7ao/meridian-core-banking">Target Repo</a> ·
  <a href="#how-it-works">Architecture</a> ·
  <a href="#the-durability-story">WDK Durability</a>
</p>

<p align="center">
  <code>Vercel WDK Hackathon — Track 1</code>
</p>

---

## What you see
<img width="1795" height="1037" alt="image" src="https://github.com/user-attachments/assets/ed5df431-92f8-4eec-acf9-4d715d69db4c" />

Open the [live demo](https://vercel-hackathon-2026-05-01.vercel.app) and you land on a Bloomberg-terminal-style war room. It auto-runs a **25-second** scripted incident on **Meridian Core Banking**: **dev-3**, a junior who normally only lands commits in `components/ui/`, pushes to **`lib/auth.ts`** off-hours and adds an outbound `fetch()` to a host outside the bank’s allowlist.

The status block flips from **ALL CLEAR** through **MONITORING** to **CRITICAL**. Five investigator agents fan out in parallel. A synthesizer collapses their findings into a verdict. The workflow pauses via **`createHook`** until a real **Discord** button interaction resumes it (`resumeHook`). The simulation loops every ~33 seconds.

Toggle to **LIVE** mode (or `?live=1`) to stream **real** pushes from the monitored GitHub repo through Redis into the same UI (timeline, agents, feed, heatmap).

In live mode, use **TRACE VIEW** for a modal with full step traces, or **BOARD REHEARSAL** to run the same three flows (ack / hold / page) while the timeline, agents, and feed stay on screen (status strip at the bottom).

---

## The monitored repository (Meridian Core Banking)

Bridge does **not** ship your real bank. It connects to **[Meridian Core Banking](https://github.com/richard7ao/meridian-core-banking)** — a **mock** “major bank core platform” repo used only for demos: **wires**, **auth**, **AML-flavored** paths, admin APIs, and observability-shaped code so structural and temporal signals read as high-stakes instead of generic SaaS noise.

| What it is | What it is not |
|------------|----------------|
| A separate GitHub repo you own and attach a **push webhook** to | Production banking software or customer data |
| Seeded **`git` history** + **`.github/CODEOWNERS`** so “novel author on critical path” is a *real* signal | A live core ledger |

**Three developer voices in the story.** The war room narrative is written around a **small cast**: **dev-3** (Devin Ross — new hire, 14-day tenure, home turf `components/ui/` only) versus **two senior ownership tracks** implied by CODEOWNERS — engineers who *normally* own **`lib/auth/*`** and **`lib/wires/*`**. When dev-3 touches auth or wires, history and behavioral detectors have something true to say. Additional synthetic committers exist in seeded history for richer baselines; the **demo loop** spotlights this **trio**.

By default, server and UI use **`richard7ao/meridian-core-banking`** (see `lib/monitored-repo.ts`). Override with **`MONITORED_REPO`** / **`NEXT_PUBLIC_MONITORED_REPO`** if you fork or rename the target.

### Connected services

Bridge is wired to **two surfaces** in production (and in full local rehearsal):

| Service | Role |
|---------|------|
| **GitHub** | **Push webhook** → `/api/webhooks/github` starts the **watchdog** workflow; **Octokit** pulls commit metadata and patches from the monitored repo. |
| **Discord** | **Bot REST** posts verdict embeds (with **Ack / Hold / Page** buttons) into your deploy channel; **`/api/discord/interactions`** verifies Discord’s **Ed25519** interaction headers and drives **`resumeHook`** so humans unblock the same paused WDK run the war room shows as suspended — not a fake poll loop. |
| **Git (rehearsal)** | **`POST /api/demo/git-rehearsal`** (Bearer `DEMO_RESET_TOKEN`) pushes a short-lived canary file to the monitored repo and deletes it after each rehearsal so **TRACE VIEW** / **BOARD REHEARSAL** exercise the same path as a real engineer push, end-to-end. |

Configure **`DISCORD_BOT_TOKEN`**, **`DISCORD_PUBLIC_KEY`**, **`DISCORD_CHANNEL_ID`**, **`GITHUB_WEBHOOK_SECRET`**, and **`GITHUB_TOKEN`** (see [Environment Variables](#environment-variables)).

---

## Why Bridge

Every team has a deploy channel where pushes go to die. A commit lands, CI goes green, and *if* something breaks, the team finds out from users — hours later.

Bridge replaces that with a war room that **investigates pushes for you**. Not just monitors. Investigates. And every investigator agent writes its findings to its own persistent memory — so it **learns long-term behavior** and gets sharper with every push it sees.

The interesting part is the **durability story**. Investigator work and the top-level **watchdog** run as **Vercel WDK** workflows. If a function dies mid-investigation, the workflow resumes where it left off. If a human is paged and takes 40 minutes to respond, the workflow simply waits — surviving cold starts and redeploys until **`resumeHook`** fires. **That is the WDK pitch made concrete.**

---

## How it works

```
GitHub push
    │
    ▼
┌─ WATCHDOG WORKFLOW ──────────────────────────────────┐
│                                                       │
│  ingest (Octokit) → extract signals → score           │
│                          │                            │
│                    score ≥ 0.6?                       │
│                          │ yes                        │
│                          ▼                            │
│  ┌─────────────────────────────────────────────────┐  │
│  │     Fan out 5 investigators (parallel)          │  │
│  │                                                 │  │
│  │  HISTORY ─┐                                     │  │
│  │  DEPENDENCY ── DurableAgent sub-workflows       │  │
│  │  DIFF ────┘                                     │  │
│  │  TRACE ───── deterministic stubs                │  │
│  │  RUNTIME ─┘                                     │  │
│  └─────────────────────────────────────────────────┘  │
│                          │                            │
│                          ▼                            │
│              SYNTHESIZER (DurableAgent)               │
│         collapses findings → structured verdict       │
│                          │                            │
│                          ▼                            │
│  Discord embed + action buttons · createHook(PAUSE)   │
│                          │                            │
│          ── workflow SUSPENDED ──                      │
│         survives redeploys, cold starts                │
│                          │                            │
│               human clicks button                     │
│            resumeHook(token, payload)                  │
│                          │                            │
│                          ▼                            │
│       update verdict in KV → SSE → war room           │
└───────────────────────────────────────────────────────┘
```

### Signal Detection

**Structural** — external `fetch()` calls, auth-path modifications, secret patterns (AWS keys, JWTs), critical-path file edits, new dependencies, new API endpoints.

**Behavioral** — author operating outside their usual directories, files modified at novel hours, unusual file co-change patterns.

**Temporal** — off-hours pushes, weekend deploys, rapid-succession commits.

**Scoring** — `0.35 × structural + 0.35 × behavioral + 0.15 × temporal + 0.15 × compound_bonus`. Compound triples like `auth_edit + external_fetch + off_hours` fire bonus escalation.

### Agent Memory — Long-Term Learning

Every investigation agent writes its findings to its own persistent memory in Redis (`memory:{agent}:{author}`). On future investigations of the same author, the agent loads its past findings and feeds them into its LLM prompt as context. This creates a learning loop:

```
Push #1 → history agent: "dev-3 has no history in lib/auth/"
Push #2 → history agent: "dev-3 touched lib/auth/ before (1 prior finding, severity high)"
Push #5 → history agent: "dev-3 is a repeat offender in lib/auth/ — 4 prior high/critical findings"
```

The behavioral baseline also evolves: after every watchdog run, `updateHistory()` records which directories each author touched, at what hours, and which files changed together. This means the behavioral detectors (author-path mismatch, hour novelty, co-change novelty) get sharper over time — what was "novel" on push #1 becomes "known" by push #5.

**Memory is durable across demo resets.** The `memory:*` and `history:*` KV keys are deliberately excluded from the reset sweep, so agents accumulate knowledge across the full lifecycle of the deployment.

| Agent | Reads from memory | Writes to memory |
|-------|-------------------|------------------|
| `history` | Past severity + summary per author | Every finding (LLM and deterministic) |
| `diff` | Past security patterns per author | Every finding (LLM and deterministic) |
| `dependency` | Past supply-chain findings per author | Every finding (LLM and deterministic) |
| `trace` | — (deterministic stub) | — |
| `runtime` | — (deterministic stub) | — |

---

## The Durability Story

This is the core of the submission. Every piece of the investigation pipeline is a durable workflow:

| Component | WDK Primitive | Survives |
|-----------|--------------|----------|
| `watchdog.ts` | `"use workflow"` | Function crashes, cold starts |
| `history.ts`, `dependency.ts`, `diff.ts` | `"use workflow"` + `generateText` | AI Gateway failures, timeouts |
| `synthesizer.ts` | `"use step"` + `generateObject` | Network errors, malformed LLM output |
| Human pause | `createHook` / `resumeHook` | Redeploys, hours/days of waiting |

**Chaos drill** (`scripts/chaos-drill.sh`): writes workflow state → SIGKILL the server → restart → verify records survive. Ran 5 consecutive successful drills before submission.

**Production rehearsals** (`scripts/e2e/rehearsal.sh`): 5/5 trigger→pause→resume→verdict cycles pass on the production Vercel deployment.

---

## Tech Stack

| Layer | Choice |
|-------|--------|
| Framework | Next.js 16 · React 19 · Tailwind 4 |
| Workflows | Vercel WDK (`workflow` 4.2 · `@workflow/ai` 4.1) |
| LLM | Claude Opus 4.7 via Anthropic API · AI SDK 6 · Max Effort |
| Storage | Redis (Vercel Marketplace / Upstash) |
| Notifications | Discord REST + interaction webhook |
| Source Ingest | Octokit 5 |
| Validation | Zod 4 |
| Testing | Vitest · 55 unit tests · 28 E2E scripts |
| Hosting | Vercel (Fluid Compute) |

---

## Quick Start

```bash
git clone https://github.com/richard7ao/vercel-hackathon-2026-05-01.git bridge
cd bridge && npm install
npm run dev
```

Open `http://localhost:3000` — the war room runs in **DEMO** mode with zero configuration. No env vars, no backend, no Redis needed for the demo loop.

### For live mode

```bash
vercel link && vercel env pull .env.local
npm run dev
# visit http://localhost:3000?live=1
```

### Environment Variables

| Variable | Source |
|----------|--------|
| `CLAUDE_KEY` | **Anthropic API key** — used for all live LLM calls (summarizer, investigator agents, verdict synthesizer). Set this in Vercel for production workflows. If unset, `ANTHROPIC_API_KEY` is used as a fallback. |
| `ANTHROPIC_API_KEY` | Optional fallback when `CLAUDE_KEY` is not set (same key, different name). |
| `AI_GATEWAY_API_KEY` | Vercel AI Gateway (optional today — verify scripts / future Gateway-only path) |
| `REDIS_URL` | Vercel Marketplace Redis |
| `GITHUB_TOKEN` | **Fine-grained PAT or classic token** with `contents:write` on the monitored repo — used by Octokit for **ingest** and for **git rehearsal** (`/api/demo/git-rehearsal`: push canary + revert). |
| `GITHUB_WEBHOOK_SECRET` | `openssl rand -hex 32` |
| `BRIDGE_REHEARSAL_PATH` | (Optional) Repo path for the rehearsal canary file; default `lib/bridge-rehearsal-canary.ts`. |
| `BRIDGE_REHEARSAL_REF` | (Optional) Branch to push canary commits to; default `main`. |
| `DISCORD_BOT_TOKEN` | Discord Developer Portal |
| `DISCORD_PUBLIC_KEY` | Discord Developer Portal |
| `DISCORD_CHANNEL_ID` | Right-click channel → Copy ID |
| `DEMO_RESET_TOKEN` | `openssl rand -hex 16` |

---

## Project Structure

```
bridge/
├── app/(warroom)/                    War room dashboard
│   ├── components/                   20 TSX components
│   │   ├── AgentCard.tsx               Agent card with scan-line animation
│   │   ├── VerdictModal.tsx            Verdict panel with concerns
│   │   ├── RehearsalModal.tsx          Live production rehearsal UI
│   │   ├── RiskScoreArc.tsx            Animated SVG risk gauge
│   │   ├── SuspendedOverlay.tsx        SUSPENDED band during Hook pause
│   │   └── ...
│   ├── hooks/
│   │   ├── useDemo.ts                  25s demo orchestration
│   │   └── useDeploysSSE.ts            Live SSE + demo mode switch
│   └── page.tsx
│
├── workflows/
│   ├── watchdog.ts                   Top-level "use workflow"
│   ├── synthesizer.ts               DurableAgent verdict builder
│   ├── agents/
│   │   ├── history.ts                  DurableAgent · git history analysis
│   │   ├── dependency.ts               DurableAgent · dependency graph
│   │   └── diff.ts                     DurableAgent · AST code analysis
│   ├── investigators/
│   │   ├── trace.ts                    Deterministic OTLP stub
│   │   └── runtime.ts                 Deterministic metrics stub
│   └── steps/
│       ├── ingest.ts                   Octokit commit fetch
│       ├── extract-signals.ts          Signal detection pipeline
│       ├── score.ts                    Risk scoring
│       └── kv-ops.ts                   Durable KV operations
│
├── lib/
│   ├── score.ts                      Weighted scoring + compound triples
│   ├── signals/                      16 signal detectors
│   ├── discord.ts                    Discord REST helpers
│   ├── db-redis.ts                   Direct Redis client
│   └── ai-gateway.ts                AI Gateway wrapper
│
├── app/api/
│   ├── webhooks/github/              GitHub push receiver
│   ├── stream/deploys/               SSE endpoint
│   ├── discord/interactions/         Discord button callback
│   ├── demo/trigger/                 Trigger workflow programmatically
│   ├── demo/resume/                  Resume paused workflow
│   └── internal/kv/                  KV read/write API
│
└── scripts/
    ├── chaos-drill.sh                WDK durability drill
    ├── e2e/                          28 E2E test scripts
    │   ├── rehearsal.sh                Production rehearsal (5 runs)
    │   ├── scenario-a/b/c.sh           Happy-path scenarios
    │   ├── chaos-*.sh                  Kill/restart recovery tests
    │   └── adv-*.sh                    Adversarial payload tests
    └── smoke-integrations.sh         External service connectivity
```

---

## Verification

```bash
npm test                              # 55 Vitest unit tests
npx tsc --noEmit                      # Type-check (0 errors)
npx next build                        # Production build
bash scripts/chaos-drill.sh           # WDK durability drill
bash scripts/smoke-integrations.sh    # External service smoke
bash scripts/e2e/rehearsal.sh         # 5 production rehearsals

# Or run against the live deployment:
BRIDGE_TARGET_URL=https://vercel-hackathon-2026-05-01.vercel.app \
  bash scripts/e2e/rehearsal.sh
```

---

## Credits

Built solo for the Vercel Community Hackathon, May 2026.

- **Vercel** — Workflow Development Kit, AI Gateway, Fluid Compute, Marketplace Redis
- **Anthropic** — Claude Opus 4.7 Max Effort (synthesizer + investigator agents)
- **Discord** — Bot API + interaction webhook
- **Octokit** — GitHub API client

The fictional *Meridian Bank* framing is for demo narrative only.

## License

MIT
