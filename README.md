<p align="center">
  <img src="docs/bridge-header.svg" alt="BRIDGE" width="100%" />
</p>

<h1 align="center">B R I D G E</h1>
<h3 align="center">Multi-Agent Deploy Security War Room</h3>

<p align="center">
  <em>A durable multi-agent system that watches every deploy, scores it for risk, dispatches five investigator agents in parallel, synthesizes a verdict, and pauses the pipeline for human acknowledgment — all on Vercel's Workflow Development Kit.</em>
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

Open the [live demo](https://vercel-hackathon-2026-05-01.vercel.app) and you land on a Bloomberg-terminal-style war room. It auto-runs a 25-second simulation of a risky deploy: a new hire pushes a change to `lib/auth.ts` at 3:42 AM that adds an outbound `fetch()` to a non-allowlisted host.

The status block flips from **ALL CLEAR** through **MONITORING** to **CRITICAL**. Five investigator agents fan out in parallel. A DurableAgent synthesizer collapses their findings into a verdict. The workflow pauses via `createHook` for a Discord button click. The simulation loops every ~33 seconds.

Toggle to **LIVE** mode (or `?live=1`) to see real GitHub webhooks flow through.

In live mode, hit **REHEARSE** to trigger all three response types (Acknowledge / Hold / Page) against the production deployment and watch the traces in real time.

---

## Why Bridge

Every team has a deploy channel where pushes go to die. A commit lands, CI goes green, and *if* something breaks, the team finds out from users — hours later.

Bridge replaces that with a war room that **investigates pushes for you**. Not just monitors. Investigates.

The interesting part is the **durability story**. Each investigator is a sub-workflow on Vercel WDK. If the function dies mid-investigation, the workflow resumes where it left off. If a human is paged and takes 40 minutes to respond, the workflow simply waits — surviving any number of cold starts and redeploys. **That is the WDK pitch made concrete.**

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

---

## The Durability Story

This is the core of the submission. Every piece of the investigation pipeline is a durable workflow:

| Component | WDK Primitive | Survives |
|-----------|--------------|----------|
| `watchdog.ts` | `"use workflow"` | Function crashes, cold starts |
| `history.ts`, `dependency.ts`, `diff.ts` | `DurableAgent` sub-workflows | AI Gateway failures, timeouts |
| `synthesizer.ts` | `DurableAgent` step | Network errors, malformed LLM output |
| Human pause | `createHook` / `resumeHook` | Redeploys, hours/days of waiting |

**Chaos drill** (`scripts/chaos-drill.sh`): writes workflow state → SIGKILL the server → restart → verify records survive. Ran 5 consecutive successful drills before submission.

**Production rehearsals** (`scripts/e2e/rehearsal.sh`): 5/5 trigger→pause→resume→verdict cycles pass on the production Vercel deployment.

---

## Tech Stack

| Layer | Choice |
|-------|--------|
| Framework | Next.js 16 · React 19 · Tailwind 4 |
| Workflows | Vercel WDK (`workflow` 4.2 · `@workflow/ai` 4.1) |
| LLM | Vercel AI Gateway → `anthropic/claude-sonnet-4-6` via AI SDK 6 |
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
| `AI_GATEWAY_API_KEY` | Vercel AI Gateway dashboard |
| `REDIS_URL` | Vercel Marketplace Redis |
| `GITHUB_WEBHOOK_SECRET` | `openssl rand -hex 32` |
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
- **Anthropic** — Claude Sonnet 4.6 (synthesizer + diff inspector)
- **Discord** — Bot API + interaction webhook
- **Octokit** — GitHub API client

The fictional *Meridian Bank* framing is for demo narrative only.

## License

MIT
