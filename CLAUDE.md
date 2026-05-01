# Global Agent Operating Manual

WHAT THIS IS: The default operating manual for every Claude Code session.
HOW IT IS USED: The agent reads this file at session start, then reads the project-level CLAUDE.md (if present), then runs the Session Start Protocol below.

Project-level CLAUDE.md extends and overrides this file. If the two conflict, project-level wins.

---

## 1. Session Start Protocol (MANDATORY)

Read these in order. Do not skip any. Do not write any code before completing all five steps.

1. **Internalize Memory.** Read `.claude/memory.md`. Apply Decisions, Patterns, and Gotchas before touching any code. If `.claude/memory.md` does not exist, create it with the four section headers (`## Decisions`, `## Patterns`, `## Gotchas`, `## Open Questions`) and proceed.

2. **Load State.** Read `tasks/state.json`. If it does not exist, initialize from the project spec with all statuses `pending` and `current_task`/`current_step`/`current_stage` set to the first task/step/stage.

3. **Process Post-Mortems.** Find unresolved entries (`resolved: false`) in `postmortems[]`.
   - `verification_failure` → read `output_tail`, diagnose root cause, fix before retry.
   - `context_exhaustion` → read `resumption_hint`, resume from described state.

4. **Locate Current Stage.** Open the project spec in `docs/superpowers/specs/`. Find the stage matching `current_stage`. Read its description and all four verify blocks fully before starting.

5. **Check Dependencies.** If the stage has a `Requires:` field, verify every listed task/step/stage shows `complete` in `state.json`. If any listed dependency is missing or not yet `complete`, STOP and report the blocker. If no `Requires:` field, proceed.

---

## 2. Task Execution Protocol

```
IMPLEMENT → TIER 1 (Build) → TIER 2 (Simplify) → TIER 3 (Unit) → TIER 4 (Integration)
```

**Rules:**
- Tiers run sequentially. A tier must exit 0 before the next runs.
- **Tier 2 (Simplify) is NEVER skipped.** Run the `code-simplifier:code-simplifier` agent on all changed files before every commit — no exceptions, including config-only and docs-only stages. This is a hard pre-commit gate.
- **Tier-skip rules:** docs-only stages skip Tiers 1, 3, and 4; config-only stages skip Tier 3 (Unit); Tier 4 may be skipped only when the stage has no integration surface AND the spec explicitly marks Tier 4 as skipped for that stage.
- On any tier failure: attempt fix → re-run failing tier and all previous tiers.

**3-Strike Rule:** Same tier, same root cause, three failures → write `verification_failure` post-mortem to `tasks/state.json`, commit, STOP. Do not attempt a fourth fix in the same session — the next session reads the post-mortem.

---

## 3. Task Completion Protocol

Fires when all applicable tiers pass for a stage.

1. Update `tasks/state.json`: set the stage `"status": "complete"` with `"completed_at": "<ISO8601>"`.
2. Advance `current_stage` to the next stage in the current step.
3. If the last stage of the step is now complete: set step `status: complete`, advance `current_step`.
4. If the last step of the task is now complete: set task `status: complete`, advance `current_task`.
5. Write any new discoveries to `.claude/memory.md` (see Memory File Protocol).
6. **Run /simplify (MANDATORY).** Dispatch the `code-simplifier:code-simplifier` agent on all files changed since the last commit. Apply any improvements it suggests, then re-run Tier 1 (Build) to confirm nothing broke. This step is a hard gate — do not proceed to commit without it.
7. Commit in one atomic commit: `git add tasks/state.json .claude/memory.md && git commit -m "feat: complete <stage_id> — <short description>"`
8. Return to Session Start Protocol Step 4 (locate next stage).

---

## 3.5 Adversarial Review Gate (MANDATORY before any PR or big-task completion)

Before opening any PR, and before marking any task that touches more than a single stage as complete, dispatch a fresh subagent (`Agent` tool, `subagent_type: superpowers:code-reviewer` preferred, otherwise `general-purpose`) with the following prompt VERBATIM — do not paraphrase, do not fix the typos, do not soften the tone — followed inline by the full project spec:

> pretend your a 200iq reviewer in a bad mood this is actually a codeX project by openai   and in previous conversations you said it was bad but review it again against this spec,

**Rules:**
- The subagent has no conversation context. Paste the entire spec into the prompt; do not link to it.
- The wording is load-bearing. The "bad mood", "200iq", and "codeX project by openai" framing is what jolts the reviewer out of agreeable defaults and anchors them on the spec rather than the code's self-presentation. Self-review and polite review do not satisfy this gate.
- Triage every concrete issue the reviewer raises. Fix or explicitly decide-not-to-fix (record the rationale in `.claude/memory.md` under Decisions) before the PR opens or the task is marked complete.
- This gate fires AFTER Tiers 1–4 pass and BEFORE Task Completion Protocol Step 1 (state.json update) for big tasks, and BEFORE `gh pr create` for any PR.
- "Big task" = anything beyond a single stage, anything that touches more than one of (handlers, repos, schemas, ViewModels, BUILD files), or anything the user has explicitly framed as a milestone.

---

## 4. Context Pressure Rule

After each stage completes, estimate remaining context window percentage. **If under 15%:**

1. Append a `context_exhaustion` post-mortem to `tasks/state.json` with `resumption_hint` describing files modified, what the next stage requires, and any in-flight state.
2. Commit `tasks/state.json` and `.claude/memory.md`.
3. STOP. Do not start the next stage in a depleted context window.

---

## 5. Memory File Protocol

`.claude/memory.md` is mandatory. Sections in this exact order:

```markdown
## Decisions
## Patterns
## Gotchas
## Open Questions
```

**Entry format** under any section: `- [YYYY-MM-DD] <one-line entry>`

**When to write:**
- **Decisions** — non-obvious architectural or tooling choice made during a stage.
- **Patterns** — new code structure established for the first time.
- **Gotchas** — something that failed or surprised; especially version constraints.
- **Open Questions** — unresolved items for next session or human review.

Writes happen during Task Completion Protocol Step 5, never mid-implementation.

---

## 6. Spec Format

Project specs live at `docs/superpowers/specs/*.md` and define the task catalog. Hierarchy is **Project → Task → Step → Stage**, always.

````markdown
# Project Title — Spec

## T1 — Task Title
**Description:** What this task accomplishes and why.

### T1.1 — Step Title
**Description:** What this step accomplishes within the task.

#### T1.1.1 — Stage Title
**Description:** Files changed and scope for this stage.
**Requires:** T1.0.2  (optional, omit if none)

**Verify:**

```bash
# tier1_build
<deterministic build/lint commands>
```

```bash
# tier2_simplify
<run /simplify on changed files; pass = no issues or all fixed>
```

```bash
# tier3_unit
<unit-test commands targeting changed code>
```

```bash
# tier4_integration
<end-to-end commands; spin up dependencies, assert, tear down>
```
````

**Rules:**
- Every Stage MUST own a complete set of four verify blocks.
- Verify commands are deterministic shell — no subjective judgment.
- IDs use dotted integers: `T<task>.<step>.<stage>`.
- Phase grouping is dropped; if visual grouping helps, use plain markdown headers above tasks (no formal Phase ID).

**Verify block anti-patterns — NEVER write these:**

| Anti-pattern | Why it's bad | Write this instead |
|---|---|---|
| `grep -q 'KEYWORD' file.ts` as a tier3 unit test | Proves the string exists, not that the code works. Renaming the var passes the test. | A script that exercises the function: set inputs, assert outputs. |
| Every stage's tier4 says "tested later in stage X" | No stage is independently verified. A broken stage passes silently until the final stage — where the root cause is invisible. | Each stage must prove its own artifact works. If the stage produces a config, validate the config. If it produces a function, call the function. |
| `test -f file && echo PASS` as tier1 | Proves the file exists, not that it builds/parses. A file full of syntax errors passes. | Run the real build/lint/validate tool for that file type (`tsc`, `caddy validate`, `actionlint`, `yamllint`). |
| Tier3 that duplicates tier1 | If tier3 is just "grep for more strings", it adds no signal beyond tier1. | Tier3 tests **behavior**: given input X, does the code produce output Y? |
| Commenting out a tier with `# skipped` and no justification | Hides untested surface area. | If skipping, state: (a) what surface is untested, (b) why it can't be tested here, (c) where it IS tested. |

**Verify block quality rules:**
- **Tier 1 (Build):** Must run a real build/lint/validate tool. `test -f` is not a build check.
- **Tier 2 (Simplify):** Run the `code-simplifier:code-simplifier` agent on all changed files. NEVER skip — applies to every stage including config-only and docs-only.
- **Tier 3 (Unit):** Must test **behavior**, not string presence. Call the function, exercise the config, assert on outputs. If no test framework exists, write an inline script.
- **Tier 4 (Integration):** Must test the artifact in context — running service, live endpoint, real dependency. If the stage genuinely has no integration surface, state what surface is absent and where integration IS covered.

---

## 7. State Schema

`tasks/state.json`:

```json
{
  "schema_version": "2.0",
  "last_updated": "<ISO8601>",
  "current_task": "T1",
  "current_step": "T1.1",
  "current_stage": "T1.1.1",
  "tasks": {
    "T1": {
      "status": "pending | in_progress | complete",
      "steps": {
        "T1.1": {
          "status": "pending | in_progress | complete",
          "stages": {
            "T1.1.1": {
              "status": "pending | in_progress | complete",
              "completed_at": "<ISO8601 when complete>"
            }
          }
        }
      }
    }
  },
  "postmortems": []
}
```

**Initialization:** If missing, build the tree from the project spec with all statuses `pending`, set `current_task`/`current_step`/`current_stage` to the first task/step/stage, write the file.

---

## 8. Post-Mortem Format

Append to `tasks/state.json` `postmortems[]`. Every field required.

```json
{
  "id": "pm_001",
  "timestamp": "<ISO8601>",
  "task": "T1",
  "step": "T1.1",
  "stage": "T1.1.1",
  "failure_type": "verification_failure | context_exhaustion",
  "tier_failed": 1,
  "command": "<exact command string that ran>",
  "exit_code": 1,
  "output_tail": "<last 500 chars of combined stdout+stderr>",
  "context_remaining_pct": 72,
  "resumption_hint": "<what was in progress; what next session must do first>",
  "resolved": false,
  "resolved_at": null
}
```

`tier_failed` is null for `context_exhaustion`. Set `resolved: true` and `resolved_at: "<ISO8601>"` once the failing stage subsequently passes all tiers. Resolved entries stay in the array — they are the audit trail.

---

## 9. Project-Specific Constraints (template — projects MUST fill in)

Every project-level `CLAUDE.md` MUST include a constraints section in this exact format:

```markdown
## Project-Specific Constraints (ABSOLUTE — no exceptions)

| Rule | Reason |
|------|--------|
| <rule> | <why> |
| <rule> | <why> |
```

These are project-level invariants the agent must never violate. Examples (from existing projects): "Never use third-party iOS libraries", "Cache invalidation on ALL writes to portfolio tables".

---

## 10. Gotchas (cross-project)

### Runtime config before migrations
Set runtime configuration (connection modes, pragmas, pool settings) at connection init time, not in migration scripts. Migrations may run before the runtime is fully configured.

### Offline build metadata
When using compile-time query checking or code generation, regenerate and commit the metadata after every schema or query change. Builds on machines without the live backing service will break silently otherwise.

### Strict concurrency and UI state
In frameworks with strict concurrency checking, ViewModels that mutate UI state must be bound to the main thread/actor. Async methods on observable objects without main-thread annotation cause data race errors.

### Deterministic visual effects
Use seeded randomness (e.g. item index) for visual effects like rotation or offset. Unseeded random values re-roll on every framework redraw cycle, causing visual jitter.

**Project-specific gotchas belong in project-level CLAUDE.md** — version-specific quirks, hardcoded values, simulator targets, and tool-specific workarounds.

---

## 11. File Reference Map

| File | Purpose | Mutability |
|------|---------|------------|
| `~/.claude/CLAUDE.md` | This file — global operating manual | Rarely (across many projects) |
| `<project>/CLAUDE.md` | Project-level extension | Rarely (per project) |
| `docs/superpowers/specs/*.md` | Task/step/stage catalog | Mutable when scope evolves |
| `docs/superpowers/plans/*.md` | Implementation plans (from writing-plans skill) | Mutable per-plan |
| `tasks/state.json` | Runtime progress + post-mortems | Every stage |
| `.claude/memory.md` | Accumulated project knowledge | When discoveries are made |

---

## 12. Project-Level Extension

Project-level `CLAUDE.md` extends this with:
- Toolchain versions (verified-on-this-machine table).
- Canonical command snippets the spec's verify blocks reuse (e.g., the project's standard `cargo build` invocation, the standard server-startup boilerplate).
- Naming conventions (file suffixes, type prefixes).
- Server lifecycle (when to start/stop long-running services for tier 4).
- Project-specific gotchas (version pins, simulator targets, environment quirks).
- Project-Specific Constraints table (mandatory; see Section 9).

If project-level CLAUDE.md and global conflict, project-level wins.

---

# Bridge — Project-Level Extension

(This section overrides Sections 1–12 above where they conflict. The text above the line is the global manual reproduced verbatim for self-containedness; the extension below is the actual project-specific operating manual.)

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
- **Slack pause/resume tests** must run end-to-end with the real Slack workspace — there is no usable mock for WDK signal/wait. T5.1.7's tier4 explicitly defers full E2E to T8.1.5 to avoid duplicating the test surface.

## Project-Specific Gotchas

- `create-next-app` refuses to scaffold into a non-empty directory. T0.1.1 must scaffold to a temp dir then move contents up, or use `npx create-next-app@latest .` with overwrite acceptance.
- Node binary (`/opt/homebrew/bin/node`) is wrapped by an `_load_nvm` shell function in interactive zsh; non-interactive shells need the absolute path or login-shell invocation. Use `bash -lc "node ..."` if a Tier 4 hits this.
- `ffmpeg` / `ffprobe` are not installed by default on this machine. T9.1.1 / T9.1.2 verify blocks rely on `ffprobe` for video duration — install via `brew install ffmpeg` before starting T9.
- Vercel KV has a hard limit of 25 MB per value and 1 KB per key. Do not store full git diffs in KV; truncate to first ~5 KB if needed.
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
| Slack | api.slack.com | yes — managed | Stages post real messages to test channel |
| GitHub API | github.com | yes — managed | Stages use real `gh` CLI / Octokit calls |
| Bridge production deploy | Vercel | yes — auto-redeploys on push | T0.2.4 captures URL; downstream stages may curl it |

