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
