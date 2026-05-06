# Bridge — Future Development

Deferred work items, roughly ordered by impact. Each section describes what would change, why it was deferred, and what the stub/fallback looks like today.

## v2 — Convert `trace` and `runtime` investigators to DurableAgent sub-workflows

**Current state:** `workflows/investigators/trace.ts` and `workflows/investigators/runtime.ts` are deterministic `"use step"` stubs. They produce synthetic findings (trace: span-gap detection; runtime: error-rate spike) without LLM reasoning.

**Target:** Each becomes a `"use workflow"` file in `workflows/agents/` with a `DurableAgent` instance, mirroring the pattern established in `history.ts`, `dependency.ts`, and `diff.ts`.

- **Trace agent tools:** `resolveSourcemap(file, line)` — maps minified stack frames to source; `querySpanGaps(traceId)` — fetches span timelines from an OTel collector and identifies gaps.
- **Runtime agent tools:** `fetchErrorRate(service, window)` — queries an OTel/Prometheus endpoint for error-rate deltas post-deploy; `fetchLatencyP99(service, window)` — same for latency.

**Why deferred:** No OTel collector or metrics endpoint exists in the demo environment. The stubs produce plausible findings that serve the demo narrative without requiring live observability infrastructure.

## v2 — Per-investigator Hook for triage-time human steering

**Current state:** The only human touchpoint is the final verdict's Discord buttons (Acknowledge / Hold / Page On-Call). Investigators run autonomously.

**Target:** Each DurableAgent investigator optionally pauses via its own `createHook` when confidence is below a threshold, posting a Discord thread asking the reviewer a clarifying question (e.g., "Is `lib/auth/session.ts` expected to be modified by this author?"). The investigator resumes when the reviewer replies.

**Why deferred:** Adds significant UX complexity (threaded Discord interactions, per-investigator Hook tokens, timeout cascades) for a feature that is better validated with real users post-hackathon.

## v2 — Vercel Queues fan-out

**Current state:** Investigator dispatch uses `Promise.allSettled` inside the watchdog workflow. Concurrent deploys each spawn their own watchdog workflow instance.

**Target:** When deploy volume exceeds N concurrent workflows, push webhook events to a Vercel Queue. A consumer workflow pulls from the queue, ensuring backpressure and ordered processing without overwhelming the runtime.

**Why deferred:** Current demo volume (single repo, manual pushes) never exceeds concurrency limits. Queue integration adds infrastructure without demo-visible benefit.

## v2 — OpenTelemetry observability via `@workflow/ai` telemetry hooks

**Current state:** Observability is `console.warn` at failure points. No structured tracing.

**Target:** Wire `@workflow/ai`'s telemetry hooks to an OTel exporter. Each DurableAgent call, tool invocation, and Hook pause/resume becomes a span. Export to Vercel's observability dashboard or a Grafana instance.

**Why deferred:** Telemetry hooks in `@workflow/ai` are experimental. Adding OTel dependencies and configuration for a hackathon demo adds weight without user-facing benefit.

## v2 — Replace deterministic-fallback flag day with DurableAgent retries

**Current state:** Every DurableAgent call wraps in try/catch and falls back to deterministic logic (`historyDeterministic`, `dependencyDeterministic`, `diffDeterministic`, `derivedVerdict`). This means AI Gateway outages silently degrade to rule-based verdicts.

**Target:** Configure DurableAgent with WDK-native retries (exponential backoff, max 3 attempts) before falling back. Log each retry attempt. After N consecutive fallbacks, emit a system-health alert to Discord.

**Why deferred:** The current fallback pattern is safe and demo-reliable. Adding retry logic increases latency in failure cases, which matters during live demos. Better to implement post-hackathon when latency budgets are more forgiving.

## v2 — Base64/hex decoder for `secret_shapes` detector

**Current state:** The `secret_shapes` signal detector scans raw patch text for patterns like `AKIA[0-9A-Z]{16}`. Secrets encoded as base64 or hex escape detection entirely (documented as an acceptable miss).

**Target:** Add a pre-scan pass that decodes base64 and hex literals in patches before running pattern detection. This catches `atob('QUtJQUlPU0ZPRE5ON0VYQU1QTEU=')` and similar obfuscation.

**Why deferred:** Decoding arbitrary strings produces false positives (many base64-like strings in code are not secrets). Needs a confidence-scoring layer to be useful without over-firing.
