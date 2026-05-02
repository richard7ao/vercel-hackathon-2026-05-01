# Bridge — Production Deploy War Room

> **A durable multi-agent system that watches a codebase's deployments. When code ships, it scores the push for risk, dispatches up to five specialist investigator agents in parallel, collapses their findings into a single verdict, and pauses for a human acknowledgement in Slack — all over a Vercel Workflow Development Kit (WDK) backbone that survives crashes, redeploys, and pauses for as long as humans need.**

---

| Resource | Link |
|---|---|
| **Live demo** | https://vercel-hackathon-2026-05-01.vercel.app |
| **Demo-target repo (the codebase Bridge watches)** | https://github.com/richard7ao/meridian-core-banking |
| **Submission video** | _captured during T9.1.3 — link inserted post-record_ |
| **Hackathon track** | Vercel Workflow Development Kit (WDK) — Track 1 |
| **Spec** | [`docs/superpowers/specs/2026-05-01-bridge-design.md`](docs/superpowers/specs/2026-05-01-bridge-design.md) |

---

## What you're looking at

Open the **live demo** above and you land on a Bloomberg-terminal-style war room. By default it auto-runs a 25-second simulation of a risky deploy: a 14-day-tenure new hire pushes a change to `lib/auth.ts` at 3:42 AM that adds an outbound `fetch()` to a non-allowlisted host. The status block flips from `ALL CLEAR` through `MONITORING` to `CRITICAL`, five investigator agents fan out in parallel and stream their findings, a synthesizer collapses them into a verdict, and the workflow pauses for a Slack acknowledgement. The simulation loops every ~33 seconds.

A `[ DEMO · auto-loop ]` chip top-right indicates simulation mode. Flip to `[ LIVE · connected ]` (or visit `?live=1`) to subscribe to real GitHub webhooks from `meridian-core-banking`.

## Why Bridge

Every team has a Slack channel where deploys go to die. A push lands, a deploy goes green, and *if* something goes wrong, the team finds out from users hours later. Bridge replaces that channel with a war room that **investigates pushes for you** — not just monitors them.

The interesting part is the durability story. Each investigator is a sub-workflow on Vercel WDK. Each step is durable. If the Vercel function dies mid-investigation, the workflow resumes where it left off. If a human is paged and takes 40 minutes to respond, the workflow simply waits — for as long as needed, surviving any number of redeploys. **That is the WDK pitch made concrete.**

## How it works

```
┌─ webhook (GitHub push) ──────────────────────────────────────────┐
│                                                                    │
│  ingest (Octokit) → extract-signals → score                        │
│                            │                                       │
│                            │ if score ≥ 0.6                        │
│                            ▼                                       │
│   ┌──────────────────────────────────────────────────────────┐    │
│   │   dispatch 5 investigator sub-workflows in parallel:     │    │
│   │                                                          │    │
│   │   trace · runtime · history · dependency · diff          │    │
│   │   (each is a DurableAgent — streaming + retries free)    │    │
│   └──────────────────────────────────────────────────────────┘    │
│                            │                                       │
│                            ▼                                       │
│                       synthesizer (LLM)                            │
│                            │                                       │
│                            ▼                                       │
│         post Block Kit message to Slack · PAUSE workflow           │
│                            │                                       │
│                            │ awaits slack:ack:{deploy_id} signal   │
│                            ▼                                       │
│                  human clicks Ack / Hold / Page                    │
│                            │                                       │
│                            ▼                                       │
│              resume → update KV → SSE → war-room reflects          │
└────────────────────────────────────────────────────────────────────┘
```

**Signals** (in `lib/signals/`): structural (external `fetch()`, auth-path edits, secret shapes, critical-path files, new dependencies, new endpoints), behavioral (author novelty against KV history, file-hour novelty, file-co-change novelty), temporal (off-hours, weekend, rapid-succession). **Scoring**: `0.35·structural + 0.35·behavioral + 0.15·temporal + 0.15·compound_bonus`. **Compound bonus** fires for triples like `auth+external_fetch+off_hours` or `critical_path+novel_author`.

## Tech stack

| Layer | Choice |
|---|---|
| Frontend | Next.js 16 · React 19 · Tailwind 4 |
| Workflows | Vercel Workflow Development Kit (`workflow` 4.2 · `@workflow/ai` 4.1) |
| LLM | Vercel AI Gateway (model: `anthropic/claude-sonnet-4-6`) via `ai` SDK 6 |
| Storage | Redis (Vercel Marketplace / Upstash) |
| Slack | `@slack/web-api` 7 + Block Kit + signing-secret-verified interactive endpoint |
| Source ingest | Octokit 5 |
| Validation | Zod 4 |
| Hosting | Vercel |

## Prerequisites

| Tool | Version |
|---|---|
| Node.js | ≥ 20 (verified: 25.8.1) |
| npm | ≥ 10 |
| Vercel CLI | latest (`npm i -g vercel`) |
| GitHub CLI (`gh`) | ≥ 2.40 |
| Vercel account | with AI Gateway access |
| GitHub account | with permission to add webhooks on the demo-target repo |
| Slack workspace | with permission to install a custom app |

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
npm run dev          # → http://localhost:3000
```

Visit `http://localhost:3000` and you'll see the war room running in DEMO mode (auto-looping simulation).

## Detailed setup

### 1. Configure environment variables

`.env.local` must contain:

| Variable | Source | Used by |
|---|---|---|
| `AI_GATEWAY_API_KEY` | https://vercel.com/ai-gateway → Create Key | Synthesizer + Diff Inspector + TL;DR |
| `REDIS_URL` | Vercel Marketplace → Redis (Upstash) → "Connect" | `lib/db.ts` storage layer |
| `MONITORED_REPO` | hardcode `meridian/core-banking` (display label only) | TopBar repo crumb |
| `GITHUB_WEBHOOK_SECRET` | `openssl rand -hex 32` (also set in GitHub webhook config) | Webhook HMAC validation |
| `SLACK_BOT_TOKEN` | Slack app → OAuth & Permissions → Install (xoxb-…) | Block Kit posts |
| `SLACK_SIGNING_SECRET` | Slack app → Basic Information → Signing Secret | Interactive endpoint verification |
| `SLACK_CHANNEL_ID` | Right-click channel → Copy link → `C…` segment | Where bot posts |
| `BRIDGE_MODE` | `demo` (default) or `production` | Trace/Runtime stub behavior |
| `DEMO_RESET_TOKEN` | `openssl rand -hex 16` | Auth on `/api/demo/reset` |
| `BUDGET_USD` | `10` (default) | Live budget meter (T8.1.7) |

Copy `.env.example` (when committed) to `.env.local`, populate, then **set every value also in the Vercel project settings** so production deploys have them.

### 2. Provision Redis

In the Vercel dashboard → your project → Storage → Create Database → Redis (Upstash). Copy `REDIS_URL`. After connecting, `vercel env pull .env.local` syncs it down.

### 3. Provision the AI Gateway key

https://vercel.com/ai-gateway → Create Key → copy as `AI_GATEWAY_API_KEY`. The gateway routes model strings like `anthropic/claude-sonnet-4-6` to the right provider with built-in fallbacks; no raw provider keys are ever stored.

### 4. Set up the Slack app

1. https://api.slack.com/apps → Create New App → From scratch.
2. **OAuth & Permissions** → Bot token scopes: `chat:write`, `chat:write.public`, `reactions:write`. Install to workspace, copy `xoxb-…` token.
3. **Basic Information** → copy Signing Secret.
4. **Interactivity & Shortcuts** → Enable. Request URL = `https://<your-deploy>/api/slack/interactive`.
5. Invite the bot to your target channel (`/invite @YourBotName`), copy the channel ID.

### 5. Set up the demo-target repo

The sibling repo at https://github.com/richard7ao/meridian-core-banking is already scaffolded. Clone it as a sibling of `bridge/`:

```bash
cd ..  # → parent dir
git clone https://github.com/richard7ao/meridian-core-banking.git
```

The Bridge spec writes `.demo-target-path` and `.demo-target-url` sentinels back into the Bridge repo so downstream stages (T6 history seeding, T8.1.1 demo trigger button) find it.

### 6. Connect the GitHub webhook

Once Bridge is deployed (next section), point the webhook from `meridian-core-banking` at it:

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

Press the war room's `[ DEMO · auto-loop ]` chip to toggle to `[ LIVE ]`. Live mode subscribes to `/api/stream/deploys` (SSE) and reflects real GitHub pushes to the demo-target repo.

## Demo modes

The deployed URL has two modes, toggled in the TopBar:

- **DEMO** (default for first-time visitors): runs the 25-second mock orchestration on a loop. No backend dependency — useful for hackathon judges, demo recordings, or showing colleagues. Data rows carry a small `· sim` superscript so simulated activity is never confused with real activity.
- **LIVE**: subscribes to real Server-Sent Events from `/api/stream/deploys`, shows real Redis-backed history and any in-flight investigations.

Mode persists via `localStorage` and is reflected in the URL (`?live=1`).

## Project structure

```
bridge/                                    ← THIS repo
├── app/(warroom)/                         ← war-room dashboard route group
│   ├── components/                        ← 11 ported TSX components
│   ├── hooks/{useDemo,useDeploysSSE}.ts
│   └── page.tsx
├── app/api/
│   ├── webhooks/github/route.ts           ← receives push events (T1.1.1)
│   ├── stream/deploys/route.ts            ← SSE endpoint (T1.3.1)
│   └── slack/interactive/route.ts         ← Slack button callback (T5.1.5)
├── lib/
│   ├── db.ts                              ← redis client wrapper
│   ├── signals/{structural,temporal,behavioral}.ts
│   ├── score.ts
│   ├── slack.ts
│   └── sse-events.ts                      ← typed event shapes
├── workflows/
│   ├── watchdog.ts                        ← top-level "use workflow"
│   ├── synthesizer.ts                     ← DurableAgent verdict builder
│   ├── investigators/{trace,runtime,history,dependency,diff}.ts
│   └── steps/{ingest,extract-signals,score,summarize}.ts
├── war-room/                              ← Claude Design handoff bundle (visual source of truth)
├── docs/superpowers/specs/                ← project spec
├── tasks/state.json                       ← stage progress (83 stages)
└── .claude/memory.md                      ← decisions, patterns, gotchas
```

## Verification

The project follows a 4-tier verify protocol per stage (defined in `docs/superpowers/specs/...md` §Verify-Block Conventions):

- **Tier 1 — Build:** `npx tsc --noEmit -p tsconfig.json`
- **Tier 2 — Simplify:** runs once before each commit on changed files (project override)
- **Tier 3 — Unit:** behavior tests via `npx tsx --input-type=module -e "..."`
- **Tier 4 — Integration:** spins up `next dev` on `:3030`, hits real endpoints, asserts on KV state and SSE stream contents

```bash
npm run lint                    # ESLint
npx tsc --noEmit                # type-check
npx next build                  # production build
```

Each stage's verify blocks are inlined in the spec (search for `# tier1_build`).

## Deployment

```bash
vercel --prod                   # deploy
```

The Vercel dashboard auto-redeploys on every push to `main` once GitHub integration is enabled.

## Status / roadmap

| Task | Status | Stages |
|---|---|---|
| T0 — Setup | Complete | 13/13 |
| T1 — Backend skeleton | In progress | 0/5 |
| T2 — Pipeline backbone | Pending | 0/18 |
| T3 — Wire war-room to live | Pending | 0/3 |
| T4 — Investigators + synthesizer | Pending | 0/8 |
| T5 — Slack pause/resume | Pending | 0/7 |
| T6 — Seed history + 3 scenarios | Pending | 0/9 |
| T7 — System-area heatmap | Pending | 0/3 |
| T8 — Demo polish + chaos drill | Pending | 0/10 |
| T9 — Record demo video | Pending | 0/3 |
| T10 — Submission | Pending | 0/4 |

**Stages complete: 13 / 83.** Current cursor: `T1.1.1` (GitHub webhook receiver).

## Hackathon context

Submitted to the Vercel Workflow Development Kit (WDK) track. The hackathon timeline assumes ~22 hours from spec authoring to submission; this README is the **primary paper deliverable** since live demos are not guaranteed (judges may select winners from submissions alone).

The real proof of the WDK durability claim is `T8.1.10`'s **chaos drill**: kill `next dev` mid-investigation, restart, verify the workflow resumes from KV. The chaos drill is included in the demo video.

## Credits

- **Vercel** — Workflow Development Kit, AI Gateway, Vercel Marketplace Redis, hosting
- **Anthropic** — Claude Sonnet 4.6 (synthesizer + diff inspector)
- **Slack** — Web API + Block Kit
- **Octokit** — GitHub API client
- **Claude Design** — visual prototype handoff (`war-room/`)

Built solo for the Vercel community hackathon, May 2026. The fictional `Meridian Bank` framing is for demo narrative only — no actual bank, customer, or wire transfer is involved at any point.

## License

MIT
