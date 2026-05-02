# Bridge — Project CLAUDE.md

> **Global operating manual lives at `~/.claude/CLAUDE.md`.** This file extends it. Where they conflict, this file wins.

---

## Protocol overrides (override the global manual)

### Tier 2 (Simplify) is removed from per-stage verify, and gated on diff size at commit time

Global CLAUDE.md §2 says "Tier 2 (Simplify) is NEVER skipped" per stage. **For this project, Tier 2 does not run per stage**, AND it does not run on every commit either. Reason: 83 stages × `code-simplifier:code-simplifier` agent dispatch = enormous compute and context budget for a hackathon-pace timeline; small commits don't have enough surface to benefit from simplification.

**Replacement rule (two-condition gate):**

1. **Per-stage:** never run the simplifier.
2. **At commit time:** run the simplifier **only if** the staged diff is **> 200 lines** (insertions + deletions, excluding lockfiles and binary files). For commits ≤ 200 lines, skip simplification entirely. For commits > 200 lines, dispatch `code-simplifier:code-simplifier` on all changed files since the last commit, apply suggested improvements, re-run Tier 1 (build) to confirm, then commit.

**Quick check before commit:**
```bash
git diff --cached --shortstat -- ':!*.lock' ':!package-lock.json' ':!*.tsbuildinfo'
# if (insertions + deletions) > 200 → run simplifier; else skip
```

The `# tier2_simplify` blocks already authored in the spec are **informational only** — they document which files would be in scope at simplify-time. They are not executed during stage verification. Per-stage verification is now: **Tier 1 (Build) → Tier 3 (Unit) → Tier 4 (Integration)**.

---

## Project-Specific Constraints (ABSOLUTE — no exceptions)

| Rule | Reason |
|------|--------|
| Pause/resume must be a real WDK Hook (`createHook`/`resumeHook`) round-trip with a real Discord button interaction. Polling KV is forbidden. | This IS the WDK durability money shot; faking loses the track |
| Investigator agents must be `DurableAgent` sub-workflows, not regular API handlers | The pitch *is* "durable sub-workflow tree" — bypassing WDK invalidates the submission |
| All LLM calls go through Vercel AI Gateway (model strings like `anthropic/claude-sonnet-4-6`); no raw provider keys | Track requirement + zero key management |
| Demo auto-runs on first paint (3-second calm hold, then play); no required click to start | Judges glance, they don't click |
| War room palette is locked: black background, mono fonts, single accent per state (amber armed / red critical / green clear). No gradients, glassmorphism, rounded-2xl, or shadcn defaults | Aesthetic is a first-class deliverable per the design brief |
| Every live data source must have a mock-data fallback path | If the backend dies mid-demo, the frontend still tells the story |
| The demo commit must trigger cleanly 5+ times in rehearsal before going live | Live demo failure = lost hackathon |

## Source Materials

- Spec: `docs/superpowers/specs/2026-05-01-bridge-design.md`
- Verbal source of truth (behavior, scoring, signals): `raw_prompt.md`
- Visual source of truth (Claude Design handoff): `war-room/` (HTML/CSS/JSX prototype)
- Hackathon resources: `track-info.md`
- Claude design URL: `https://api.anthropic.com/v1/design/h/Ry1KGi5XlJWoDA1GfmhpHw` (gated; `war-room/` is the local mirror)

When `raw_prompt.md` and `war-room/` disagree, `war-room/` wins for visual specifics; `raw_prompt.md` wins for backend behavior.

## Verified Toolchain (this machine, 2026-05-01)

| Tool | Version | Path |
|------|---------|------|
| Node.js | v25.8.1 | `/opt/homebrew/bin/node` |
| npm | 11.11.0 | `/opt/homebrew/bin/npm` |
| git | 2.50.1 (Apple Git-155) | system |
| gh CLI | 2.88.1 (2026-03-12) | system |
| Vercel CLI | 51.7.0 | `/opt/homebrew/bin/vercel` |
| OpenSSL | LibreSSL 3.3.6 | system |
| **ffmpeg/ffprobe** | **NOT INSTALLED** | run `brew install ffmpeg` before T9 |

## Canonical Command Snippets (verify blocks reuse these)

**TypeScript-source unit test (Tier 3) template:**
```bash
npx tsx --input-type=module -e "import('./path/to/module.ts').then(({ exportedFn }) => { /* asserts */ console.log('OK'); })"
```

**Tier 4 server lifecycle (start dev → wait → assert → cleanup):**
```bash
(npx next dev -p 3030 > /tmp/bridge-dev.log 2>&1 &) && \
for i in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15; do curl -fsS http://localhost:3030 > /dev/null 2>&1 && break; sleep 1; done && \
<assertions here> ; ec=$? ; \
pkill -f 'next dev.*3030' || true ; \
exit $ec
```

**Vercel KV smoke test:**
```bash
node -e "require('dotenv').config({path:'.env.local'}); fetch(process.env.KV_REST_API_URL + '/ping', { headers: { Authorization: 'Bearer ' + process.env.KV_REST_API_TOKEN } }).then(r => process.exit(r.ok ? 0 : 1))"
```

**AI Gateway smoke test:**
```bash
node -e "require('dotenv').config({path:'.env.local'}); fetch('https://gateway.ai.vercel.app/v1/chat/completions', { method: 'POST', headers: { Authorization: 'Bearer ' + process.env.AI_GATEWAY_API_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ model: 'anthropic/claude-sonnet-4-6', messages: [{ role: 'user', content: 'reply OK' }], max_tokens: 5 }) }).then(r => process.exit(r.ok ? 0 : 1))"
```

## Naming Conventions

- Stage IDs: dotted integers `T<task>.<step>.<stage>` (e.g., `T2.4.3`).
- File layout: `lib/` for pure logic, `workflows/` for `"use workflow"` and `"use step"` files, `app/api/` for HTTP handlers, `app/(warroom)/` for the dashboard route group, `data/` for one-shot scripts, `scripts/` for shell helpers.
- KV keys: `<noun>:<key>` (e.g., `deploys:abc123`, `history:author:dev-3`, `investigator:dep_048:history`). Lowercase, colon-separated.
- React components: PascalCase TSX files, one component per file, named export matching filename.
- Workflow functions: camelCase, file matches function name (`watchdog.ts` → `export function watchdog`).

## Server Lifecycle

- **Tier 4 stages own their own dev server** — start in background on PORT=3030, wait until ready, run assertions, kill cleanly. Stages don't share servers (avoid cross-contamination).
- **Long-running workflows** (anything in `workflows/`) are tested by either: (a) invoking the workflow function directly via `npx tsx` and asserting on KV side effects, or (b) hitting the deployed Vercel URL and asserting on SSE stream content.
- **Discord pause/resume tests** must run end-to-end with a real Discord interaction — there is no usable mock for WDK `createHook`/`resumeHook`. Full E2E (Hook round-trip) is covered in T3.1 chaos drill and T6 adversarial testing.

## Project-Specific Gotchas

- `create-next-app` refuses to scaffold into a non-empty directory. T0.1.1 must scaffold to a temp dir then move contents up, or use `npx create-next-app@latest .` with overwrite acceptance.
- Node binary (`/opt/homebrew/bin/node`) is wrapped by an `_load_nvm` shell function in interactive zsh; non-interactive shells need the absolute path or login-shell invocation. Use `bash -lc "node ..."` if a Tier 4 hits this.
- `ffmpeg` / `ffprobe` are not installed by default on this machine. T9.1.1 / T9.1.2 verify blocks rely on `ffprobe` for video duration — install via `brew install ffmpeg` before starting T9.
- Vercel KV has a hard limit of 25 MB per value and 1 KB per key. Do not store full git diffs in KV; truncate to first ~5 KB if needed.
- **`CLAUDE_KEY`** (Anthropic API key) is what live workflows use today: `lib/ai-gateway.ts` reads **`CLAUDE_KEY`** first, then **`ANTHROPIC_API_KEY`**. Set **`CLAUDE_KEY`** in Vercel project env so production pushes and rehearsals get real LLM output (otherwise calls fall back or fail softly per step).
- AI Gateway model strings use `provider/model` form (`anthropic/claude-sonnet-4-6`, NOT `claude-sonnet-4-6` alone). Bare model names route through the default provider and may not match Claude.
- `.env.local` must be in `.gitignore` before any commit. T0.1.4's tier1 verifies this. If a commit happens with secrets, rotate the keys before continuing.
- The `war-room/` folder uses CDN React + Babel inline transforms; the production port to Next.js (T0.3.1–T0.3.3) replaces these with real npm imports.
- Cuttable items — even though the spec is linear-strict — in priority order if context exhausts: T7 (system heatmap, fall back to existing files-x-hours), T8.1.5 third dry run (do 2 instead of 3), T4.2.2 dependency investigator (drop, keep history + diff). Document any cut as a `context_exhaustion` post-mortem.

## Server / External Service Lifecycle

| Service | Started By | Long-running? | Tier 4 expectation |
|---------|-----------|---------------|--------------------|
| `next dev` | each Tier 4 | no — per-stage | Stage starts, asserts, kills |
| Vercel KV | Vercel infra | yes — managed | Stages assume reachable; tested via `KV_REST_API_URL/ping` |
| AI Gateway | Vercel infra | yes — managed | Stages call directly; failures retry per WDK |
| Discord | discord.com/api | yes — managed | Stages post real embeds to test channel |
| GitHub API | github.com | yes — managed | Stages use real `gh` CLI / Octokit calls |
| Bridge production deploy | Vercel | yes — auto-redeploys on push | T0.2.4 captures URL; downstream stages may curl it |

