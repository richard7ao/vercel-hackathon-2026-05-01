## Decisions

- [2026-05-01] Granularity = fine-grained per CLAUDE.md §6 — every meaningful checkbox in raw_prompt.md is its own Stage. Final count: 11 tasks · 26 steps · **80 stages** (was 75 before the rigor upgrade; +2 in T6.2 for 3-scenario staging, +3 in T8.1 for cinematic stages).
- [2026-05-01] Spec strategy = linear strict (no `Cuttable:` markers). Time pressure handled exclusively via `context_exhaustion` post-mortems, not by spec-baked optionality.
- [2026-05-01] Demo target repo = `meridian/core-banking` — fictional major bank, framing chosen for stakes amplification ("core banking" + "wires" makes auth-exfil read as catastrophic, not annoying). Cloned locally as `../meridian-core-banking/`. Reason: judge framing ROI is high; engineering cost is the same as a generic SaaS scaffold.
- [2026-05-01] Demo author = `dev-3` (Devin Ross), 14 days tenure, home turf is `components/ui/` only. Reason: a *true* novel-area finding when they touch `lib/auth/*` makes the History Inspector's claim land as fact, not theatre. Other 8 seeded authors mapped to home areas with CODEOWNERS rules in `meridian-core-banking/.github/CODEOWNERS`.
- [2026-05-01] **Three demo scenarios**, not one. Live: A — auth-exfil on `demo/exfil`. Pre-canned: B — privilege escalation (new `app/api/admin/wire-override/route.ts` skipping requireRole) on `demo/privesc`. Pre-canned: C — hardcoded credential leak (AKIA + JWT) in `lib/observability/emit.ts` on `demo/leak`. Each scenario fires a *different* signal+investigator combination so the demo proves generality, not a one-trick.
- [2026-05-01] War-room/ Claude Design handoff bundle is the canonical visual source of truth (pixel-precise tokens/components/animations); raw_prompt.md is the verbal source for backend behavior. On conflict: war-room wins for visuals, raw_prompt wins for behavior.
- [2026-05-01] Demo-mode vs production-mode for trace/runtime stub investigators — both code paths exist, controlled by `BRIDGE_MODE` env (default `production` shows N/A; `demo` runs synthesized streams matching war-room/app.jsx). Reason: war-room design shows all 5 agents live; raw_prompt §4c says stub trace/runtime. Resolved by implementing both.
- [2026-05-01] Top bar `REPO` crumb is parameterized via `MONITORED_REPO` env (= `meridian/core-banking` in our setup); the war-room/ design's hardcoded `acme/control-plane` is the design fallback only.
- [2026-05-01] Tier 3 verify commands run via `npx tsx --input-type=module -e "..."` (not raw `node`) for any TypeScript-source imports. `tsx` added as dev dep in T0.2.1. Reason: Node cannot import `.ts`/`.tsx` directly without a loader; pre-compiling per stage is wasteful.
- [2026-05-01] Skills folder disposition: existing `skills/{identify-the-players,analyze-existing-solutions,pitch-solutions}` are NHS-flavoured hackathon strategy skills unrelated to Bridge implementation. Left in place; not invoked by Bridge code paths. `skills/brainstorming/` was added in this session as a local mirror of the global plugin.
- [2026-05-01] Claude design URL `https://api.anthropic.com/v1/design/h/Ry1KGi5XlJWoDA1GfmhpHw` is gated (POST-only API endpoint + Cloudflare auth on claude.ai mirror). Cannot be fetched by tools. The `war-room/` folder bundle is the local mirror and the implementation source of truth. URL embedded in spec for human reviewers (judges/teammates).
- [2026-05-01] Verify-block rigor bar (§"Rigor bar" in spec) is mandatory for every behaviour-bearing stage: tier3 ≥ 5 cases (happy + negative + ≥3 edge + ≥1 adversarial + config), tier4 must do at least one of (cross-stage integration / real external dep / E2E against running stack / failure-mode / idempotence). Tier4 may NOT duplicate tier3 with extra cases. **T2.2.1 is the canonical exemplar.** Other behaviour stages must match that bar at implementation time.
- [2026-05-01] Cinematic moments specced in T8.1.5–7: WORKFLOW SUSPENDED overlay + resume green pulse + PAGE pulse during the Slack pause; animated risk-score arc + smooth token tick on agent cards; live budget tick-down + state-flip flashes + investigator scan-line shimmer. Reason: the durability moment must be legible without narration — visuals do the work.
- [2026-05-01] T8.1.10 (was T8.1.8 before judge-mode-UX renumber) includes a chaos drill (kill `next dev` mid-investigation, restart, verify workflow resumes from KV). This is the actual proof of the WDK durability claim. The chaos drill must succeed in rehearsal — it's the spec's real test for "the WDK pitch is true".
- [2026-05-02] **Demo mode is now the production default**, not opt-in.
- [2026-05-02] **README.md is the secondary primary surface** (after the deployed URL). Bumped T10.1.2 from ≥500 words to 800–1200 words.
- [2026-05-02] **T9 (video) reframed from "insurance" to "primary deliverable"** and runs in parallel with T8 polish.
- [2026-05-02] **T10.1.3 is Notion form only** — Vercel global pool dropped.
- [2026-05-02] **Honest sim-suffix** in DEMO mode.
- [2026-05-02] **Stage count: 83**.
- [2026-05-02] AI Gateway unreachable from local machine — mock fallback in summarize.ts, tracked in unresolved.md
- [2026-05-02] **Switched T5 from Slack to Discord** — user doesn't have Slack enterprise, Discord bot is free and simpler. All Slack references in T5 stages become Discord equivalents. Core WDK signal/wait pattern unchanged.
- [2026-05-02] **T6.7.1 adversarial review**: 5 issues fixed (dead discord.js dep, broken parseLLMVerdict refs in smoke harness, misleading header, decorative DurableAgent investigators, misleading chaos drill README claim). 4 deferred: `using` vs `const` hook (TS5.2 dep), summarize.ts generateText (out of T1 scope), empty behavioral/temporal signals (pre-existing), webhook not triggering workflow (by design — WDK runtime).

## Patterns

- [2026-05-01] SSE event types live in `lib/sse-events.ts` as a discriminated union on `type`.
- [2026-05-01] KV key conventions documented at the top of `lib/db.ts`.
- [2026-05-01] Tier 4 server lifecycle: each stage owns its own `next dev -p 3030`.
- [2026-05-01] Investigators: 3 DurableAgent sub-workflows in `workflows/agents/{history,dependency,diff}.ts`, 2 deterministic stubs in `workflows/investigators/{trace,runtime}.ts`. Deterministic fallbacks in `workflows/investigators/*.ts`.
- [2026-05-02] Pause/resume uses WDK `createHook`/`resumeHook` — watchdog creates a Hook, Discord interaction handler calls `resumeHook(token, payload)` from `workflow/api`.
- [2026-05-02] AI SDK v6 + Zod v4 tools use `tool()` helper with `inputSchema: zodSchema(z.object({...}))` pattern, not `parameters` directly.
- [2026-05-02] CJS/ESM interop for tsx: `const mod = await import(...); const { x } = mod.default || mod;`
- [2026-05-02] KV double-serialization: kv.set already JSON.stringifies, don't wrap values in JSON.stringify
- [2026-05-02] Dotenv must load before any module that reads env vars

## Gotchas

- [2026-05-01] `war-room/project/` uses CDN React 18.3.1 + Babel standalone — production port replaces with real .tsx imports.
- [2026-05-01] Node binary at `/opt/homebrew/bin/node` — needs `bash -lc` for nvm.
- [2026-05-01] `create-next-app` refuses non-empty directory.
- [2026-05-01] AI Gateway base URL is `https://gateway.ai.vercel.app/v1/`.
- [2026-05-02] EventSource.onmessage only catches unnamed events; named SSE events need addEventListener per type
- [2026-05-02] Tailwind v4 uses CSS-based config with `@theme inline` directive
- [2026-05-02] AI SDK v6 uses `maxOutputTokens` not `maxTokens`
- [2026-05-02] kv.get already parses JSON — don't wrap result in JSON.parse

## Open Questions

- [2026-05-01] WDK signal/wait primitive name varies across WDK versions.
- [2026-05-01] Whether to keep existing `skills/` folder untouched.
- [2026-05-01] T7 (heatmap) — if time pressure forces a skip, append context_exhaustion post-mortem.
- [2026-05-02] AI Gateway connectivity — ECONNRESET from local machine, works on Vercel?
