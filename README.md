# Bridge — Production Deploy War Room

![Bridge war room in CRITICAL state](docs/screenshot-critical.png)

> **A durable multi-agent system that watches a codebase's deployments. When code ships, it scores the push for risk, dispatches specialist investigator agents in parallel (three as DurableAgent sub-workflows, two as deterministic stubs), collapses their findings into a single verdict via a DurableAgent synthesizer, and pauses for a human acknowledgement via Discord using WDK's `createHook`/`resumeHook` — all over a Vercel Workflow Development Kit (WDK) backbone that survives crashes, redeploys, and pauses for as long as humans need.**

---

| Resource | Link |
|---|---|
| **Live demo** | https://vercel-hackathon-2026-05-01.vercel.app |
| **Demo-target repo (the codebase Bridge watches)** | https://github.com/richard7ao/meridian-core-banking |
| **Submission video** | _link inserted post-record_ |
| **Hackathon track** | Vercel Workflow Development Kit (WDK) — Track 1 |

---

## What you're looking at

Open the **live demo** above and you land on a Bloomberg-terminal-style war room. By default it auto-runs a 25-second simulation of a risky deploy: a new hire pushes a change to `lib/auth.ts` at 3:42 AM that adds an outbound `fetch()` to a non-allowlisted host. The status block flips from `ALL CLEAR` through `MONITORING` to `CRITICAL`, investigator agents fan out in parallel and stream their findings, a DurableAgent synthesizer collapses them into a verdict, and the workflow pauses via `createHook` for a Discord acknowledgement. The simulation loops every ~33 seconds.

A `[ DEMO · auto-loop ]` chip top-right indicates simulation mode. Flip to `[ LIVE · connected ]` (or visit `?live=1`) to subscribe to real GitHub webhooks from `meridian-core-banking`.

## Why Bridge

Every team has a channel where deploys go to die. A push lands, a deploy goes green, and *if* something goes wrong, the team finds out from users hours later. Bridge replaces that channel with a war room that **investigates pushes for you** — not just monitors them.

The interesting part is the durability story. Each investigator is a sub-workflow on Vercel WDK. Each step is durable. If the Vercel function dies mid-investigation, the workflow resumes where it left off. If a human is paged and takes 40 minutes to respond, the workflow simply waits — for as long as needed, surviving any number of redeploys. **That is the WDK pitch made concrete.**

## How it works

```
┌─ webhook (GitHub push) ──────────────────────────────────────────┐
│                                                                    │
│  ingest (Octokit) → extract-signals → score                        │
│                            │                                       │
│                            │ if score >= 0.6                       │
│                            v                                       │
│   ┌──────────────────────────────────────────────────────────┐    │
│   │   dispatch investigator sub-workflows in parallel:       │    │
│   │                                                          │    │
│   │   history · dependency · diff  (DurableAgent workflows)  │    │
│   │   trace · runtime              (deterministic stubs)     │    │
│   └──────────────────────────────────────────────────────────┘    │
│                            │                                       │
│                            v                                       │
│                   synthesizer (DurableAgent)                       │
│                            │                                       │
│                            v                                       │
│     post embed + buttons to Discord · createHook (PAUSE)           │
│                            │                                       │
│                            │ awaits resumeHook(deploy:ack:{id})    │
│                            v                                       │
│            human clicks Acknowledge / Hold / Page                  │
│                            │                                       │
│                            v                                       │
│              resume → update KV → SSE → war-room reflects          │
└────────────────────────────────────────────────────────────────────┘
```

**Signals** (in `lib/signals/`): structural (external `fetch()`, auth-path edits, secret shapes, critical-path files, new dependencies, new endpoints), behavioral (author novelty against KV history, file-hour novelty, file-co-change novelty), temporal (off-hours, weekend, rapid-succession). **Scoring**: `0.35 * structural + 0.35 * behavioral + 0.15 * temporal + 0.15 * compound_bonus`. **Compound bonus** fires for triples like `auth + external_fetch + off_hours` or `critical_path + novel_author`.

## Tech stack

| Layer | Choice |
|---|---|
| Frontend | Next.js 16 · React 19 · Tailwind 4 |
| Workflows | Vercel Workflow Development Kit (`workflow` 4.2 · `@workflow/ai` 4.1) |
| LLM | Vercel AI Gateway (model: `anthropic/claude-sonnet-4-6`) via `ai` SDK 6 |
| Storage | Redis (Vercel Marketplace / Upstash) |
| Notifications | Discord REST API + interaction webhook |
| Source ingest | Octokit 5 |
| Validation | Zod 4 |
| Hosting | Vercel |

## Quick start

```bash
# 1. Clone + install
git clone https://github.com/richard7ao/vercel-hackathon-2026-05-01.git bridge
cd bridge
npm install

# 2. Pull env from Vercel (after linking — see Detailed setup)
vercel link
vercel env pull .env.local

# 3. Run locally
npm run dev          # -> http://localhost:3000
```

Visit `http://localhost:3000` and you'll see the war room running in DEMO mode (auto-looping simulation). No environment variables needed for demo mode.

## Environment variables

`.env.local` must contain these for live mode and production:

| Variable | Source | Used by |
|---|---|---|
| `AI_GATEWAY_API_KEY` | Vercel AI Gateway dashboard | Synthesizer + diff inspector + TL;DR generation |
| `REDIS_URL` | Vercel Marketplace Redis (Upstash) | `lib/db.ts` storage layer |
| `GITHUB_WEBHOOK_SECRET` | `openssl rand -hex 32` (also set in GitHub webhook config) | Webhook HMAC validation |
| `DISCORD_BOT_TOKEN` | Discord Developer Portal → Bot → Token | Posting verdict embeds |
| `DISCORD_PUBLIC_KEY` | Discord Developer Portal → General Information | Interaction webhook verification |
| `DISCORD_CHANNEL_ID` | Right-click channel → Copy Channel ID | Where bot posts verdicts |
| `MONITORED_REPO` | Hardcode `meridian/core-banking` (display label) | TopBar repo crumb |
| `BRIDGE_MODE` | `demo` (default) or `production` | Trace/runtime investigator behavior |
| `DEMO_RESET_TOKEN` | `openssl rand -hex 16` | Auth on `/api/demo/reset` |
| `BUDGET_USD` | `10` (default) | Live budget meter baseline |

## Detailed setup

### 1. Provision Redis

In the Vercel dashboard: your project → Storage → Create Database → Redis (Upstash). Copy `REDIS_URL`. After connecting, `vercel env pull .env.local` syncs it down.

### 2. Provision the AI Gateway key

Vercel AI Gateway dashboard → Create Key → copy as `AI_GATEWAY_API_KEY`. The gateway routes model strings like `anthropic/claude-sonnet-4-6` to the right provider with built-in fallbacks; no raw provider keys are ever stored.

### 3. Set up the Discord bot

1. https://discord.com/developers/applications → New Application.
2. **Bot** tab → Reset Token → copy as `DISCORD_BOT_TOKEN`. Enable "Message Content Intent".
3. **General Information** → copy Public Key as `DISCORD_PUBLIC_KEY`.
4. **OAuth2** → URL Generator → scopes: `bot`, `applications.commands`. Bot permissions: Send Messages, Embed Links, Use Slash Commands. Use generated URL to invite to your server.
5. **General Information** → Interactions Endpoint URL = `https://<your-deploy>/api/discord/interactions`.
6. Copy the channel ID where the bot should post verdicts as `DISCORD_CHANNEL_ID`.

### 4. Set up the demo-target repo

The sibling repo at https://github.com/richard7ao/meridian-core-banking is already scaffolded with three demo branches (`demo/exfil`, `demo/privesc`, `demo/leak`). Clone it as a sibling:

```bash
cd ..
git clone https://github.com/richard7ao/meridian-core-banking.git
```

### 5. Connect the GitHub webhook

Once Bridge is deployed, point the webhook from `meridian-core-banking` at it:

```bash
gh api repos/richard7ao/meridian-core-banking/hooks \
  --method POST \
  -f config[url]="https://<your-deploy>/api/webhooks/github" \
  -f config[content_type]=json \
  -f config[secret]="$GITHUB_WEBHOOK_SECRET" \
  -f events[]=push
```

## Running locally

```bash
npm run dev    # Next.js dev server on :3000
```

The war room opens in DEMO mode by default — a fully client-side 25-second simulation that needs no backend. Toggle the `[ DEMO · auto-loop ]` chip to `[ LIVE ]` to subscribe to `/api/stream/deploys` (SSE) and reflect real GitHub pushes.

Mode persists via `localStorage` and is also controllable via URL (`?live=1`).

## Project structure

```
bridge/
├── app/(warroom)/                         <- war-room dashboard route group
│   ├── components/                        <- 19 TSX components
│   │   ├── AgentCard.tsx                     agent card with scan-line shimmer
│   │   ├── RiskScoreArc.tsx                  animated SVG risk gauge
│   │   ├── StatusBlock.tsx                   top status block with budget meter
│   │   ├── SystemHeatmap.tsx                 6-cell area heatmap
│   │   ├── VerdictModal.tsx                  verdict panel with concerns
│   │   ├── SuspendedOverlay.tsx              SUSPENDED band during pause
│   │   ├── ModeToggle.tsx                    DEMO/LIVE toggle
│   │   └── ...                               (12 more)
│   ├── hooks/
│   │   ├── useDemo.ts                        25s demo orchestration
│   │   ├── useDeploysSSE.ts                  live SSE + demo mode switch
│   │   └── useTickedNumber.ts                smooth counter animation
│   ├── data.ts                            <- types + initial mock data
│   └── page.tsx
├── app/api/
│   ├── webhooks/github/route.ts           <- receives push events
│   ├── stream/deploys/route.ts            <- SSE endpoint
│   ├── discord/interactions/route.ts      <- Discord button callback
│   ├── demo/reset/route.ts               <- reset demo state
│   └── demo/run/route.ts                 <- trigger demo scenario
├── lib/
│   ├── db.ts                              <- Redis client wrapper
│   ├── discord.ts                         <- Discord REST API helpers
│   ├── signals/
│   │   ├── structural.ts                     10 structural signal detectors
│   │   ├── behavioral.ts                     3 behavioral signal detectors
│   │   └── temporal.ts                       3 temporal signal detectors
│   ├── score.ts                           <- weighted scoring + compound triples
│   ├── cost-meter.ts                      <- budget tracking
│   ├── file-classifier.ts                <- file -> area classification
│   ├── critical-paths.ts                 <- critical path definitions
│   └── sse-events.ts                      <- typed SSE event shapes
├── workflows/
│   ├── watchdog.ts                        <- top-level "use workflow"
│   ├── synthesizer.ts                     <- DurableAgent verdict builder ("use step")
│   ├── agents/
│   │   ├── history.ts                        DurableAgent sub-workflow
│   │   ├── dependency.ts                     DurableAgent sub-workflow
│   │   └── diff.ts                           DurableAgent sub-workflow
│   ├── investigators/
│   │   ├── _base.ts                          shared investigator base
│   │   ├── trace.ts, runtime.ts              deterministic stubs (v2: DurableAgent)
│   │   ├── history.ts                        deterministic fallback
│   │   ├── dependency.ts                     deterministic fallback
│   │   └── diff.ts                           deterministic fallback
│   └── steps/
│       ├── ingest.ts                         Octokit commit fetch
│       ├── extract-signals.ts                signal pipeline
│       ├── score.ts                          risk scoring
│       └── summarize.ts                      TL;DR generation
├── data/
│   ├── seed-history.ts                    <- seed 90 historical deploys
│   └── preview-staged.ts                  <- validate demo scenario scores
├── scripts/
│   ├── reset-demo.sh                      <- idempotent demo reset
│   ├── full-demo-rehearsal.sh             <- 5-phase rehearsal script
│   ├── chaos-drill.sh                     <- WDK durability drill
│   └── smoke-integrations.sh             <- external service connectivity checks
├── demo/
│   └── script.md                          <- 3-minute recording script
└── war-room/                              <- Claude Design handoff (visual source)
```

## The WDK durability story

This is the core of the submission. The investigation pipeline is a tree of durable workflows:

- **`watchdog.ts`** is the top-level workflow (`"use workflow"`). It receives a GitHub push, scores it, and if risky, dispatches investigators.
- **Three investigators** (`history`, `dependency`, `diff`) are `DurableAgent` sub-workflows (`"use workflow"` files in `workflows/agents/`). Each wraps a `DurableAgent` from `@workflow/ai/agent` with domain-specific tools, falling back to deterministic logic if the AI Gateway is unreachable.
- **Two investigators** (`trace`, `runtime`) are deterministic stubs (`"use step"` in `workflows/investigators/`). Converting them to DurableAgent is deferred to v2 (see `docs/future-development.md`).
- **The synthesizer** uses a `DurableAgent` to collapse findings into a verdict, posts it to Discord with action buttons, then **pauses the workflow** using `createHook` from the WDK.
- **The workflow stays paused** — surviving redeploys, cold starts, and server restarts — until a human clicks a button in Discord. The interaction webhook calls `resumeHook(token, payload)`, and the workflow resumes.

The **chaos drill** (`scripts/chaos-drill.sh`) proves this: it kills the dev server mid-investigation, restarts it, and verifies the workflow picks up where it left off.

## Verification

```bash
npx tsc --noEmit                # type-check (0 errors)
npx next build                  # production build
npm test                        # 55 Vitest unit tests (score, synthesizer, watchdog)
bash scripts/smoke-integrations.sh   # smoke harness — pings live external services
bash scripts/chaos-drill.sh     # WDK durability drill (kill + restart + verify resume)
```

## Deployment

```bash
vercel --prod
```

Auto-redeploys on every push to `main` once the Vercel GitHub integration is enabled.

## Status

| Task | Description | Status |
|---|---|---|
| T0 | Setup + scaffold | Complete |
| T1 | Backend skeleton (webhook, SSE, KV) | Complete |
| T2 | Signal pipeline (structural, behavioral, temporal, scoring) | Complete |
| T3 | Wire war-room to live data | Complete |
| T4 | Investigators + synthesizer | Complete |
| T5 | Discord pause/resume | Complete |
| T6 | Seed history + 3 demo scenarios | Complete |
| T7 | System-area heatmap | Complete |
| T8 | Demo polish + cinematic + chaos drill | Complete |
| T9 | Record demo video | Pending (human task) |
| T10 | Submission | Pending (human task) |

**All code stages complete.** Remaining work is recording the demo video and submitting.

## Credits

- **Vercel** — Workflow Development Kit, AI Gateway, Vercel Marketplace Redis, hosting
- **Anthropic** — Claude Sonnet 4.6 (synthesizer + diff inspector)
- **Discord** — bot API + interaction webhook
- **Octokit** — GitHub API client
- **Claude Design** — visual prototype handoff (`war-room/`)

Built solo for the Vercel community hackathon, May 2026. The fictional `Meridian Bank` framing is for demo narrative only — no actual bank, customer, or wire transfer is involved.

## License

MIT
