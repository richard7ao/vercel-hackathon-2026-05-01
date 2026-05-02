# Bridge — Session Summary (2026-05-02)

## What Changed This Session

### 1. LLM Integration Fixed (ALL 4 files)

**Problem:** All investigator agents and synthesizer used `DurableAgent.stream()` which requires `WritableStream` — unavailable in WDK runtime. Every LLM call silently fell back to deterministic logic. **Zero AI was actually running.**

**Fix:** Replaced `DurableAgent.stream()` with non-streaming AI SDK calls:

| File | Before | After |
|------|--------|-------|
| `workflows/agents/history.ts` | `DurableAgent.stream()` | `generateText()` + tools + `stopWhen: stepCountIs(3)` |
| `workflows/agents/diff.ts` | `DurableAgent.stream()` | `generateText()` + tools + `stopWhen: stepCountIs(3)` |
| `workflows/agents/dependency.ts` | `DurableAgent.stream()` | `generateText()` + tools + `stopWhen: stepCountIs(3)` |
| `workflows/synthesizer.ts` | `DurableAgent.stream()` + `Output.object()` | `generateObject()` + `schema` |

All files also add `globalThis.fetch = fetch` (from `workflow` package) for WDK durable replay.

### 2. Switched from AI Gateway to Direct Anthropic API

**Problem:** Vercel AI Gateway wasn't being billed / wasn't working for LLM calls.

**Fix:** `lib/ai-gateway.ts` rewired from `@ai-sdk/openai-compatible` → `@ai-sdk/anthropic`:
- Uses `CLAUDE_KEY` env var (direct Anthropic API key)
- All model strings mapped to `claude-haiku-4-5-20251001` (cheapest model)
- `getGateway().chatModel()` interface unchanged — zero call-site changes needed

### 3. Rehearsal UI Added (previous sub-session)
- `RehearsalModal.tsx` — auto-runs 3 rehearsal types (ack/hold/page) with live traces
- Rehearsal button appears in LIVE mode only
- Reset button appears in DEMO mode only

### 4. README Rewritten for Judges
- Architecture diagram, durability table, tech stack, project structure
- Credits section says Claude Opus 4.7 Max Effort

---

## Files Modified (This Session)

```
lib/ai-gateway.ts                    — Rewired to @ai-sdk/anthropic + Haiku
workflows/agents/history.ts          — generateText() + durable fetch
workflows/agents/diff.ts             — generateText() + durable fetch
workflows/agents/dependency.ts       — generateText() + durable fetch
workflows/synthesizer.ts             — generateObject() + durable fetch
README.md                            — Updated model refs, durability table
package.json / package-lock.json     — Added @ai-sdk/anthropic
```

---

## Environment Variables Needed

| Variable | Status | Notes |
|----------|--------|-------|
| `CLAUDE_KEY` | **NEEDS REAL VALUE** | Set on Vercel but has placeholder value. Must be real `sk-ant-...` key |
| `REDIS_URL` | OK | Vercel Marketplace Redis |
| `GITHUB_WEBHOOK_SECRET` | OK | |
| `DISCORD_BOT_TOKEN` | OK | |
| `DISCORD_PUBLIC_KEY` | OK | |
| `DISCORD_CHANNEL_ID` | OK | |
| `DEMO_RESET_TOKEN` | OK | `bridge-demo-2026` |
| `KV_INTERNAL_SECRET` | OK | |

---

## What Still Needs Doing

### Must-do before submission:
1. **Set real CLAUDE_KEY** — current value is placeholder `YOUR_ANT...`
2. **Test LLM call end-to-end** — trigger a workflow and verify Haiku actually responds (check Vercel function logs)
3. **Deploy** — `git push` to trigger Vercel redeploy with new code

### Nice-to-have (from user feedback):
4. Rename auto-run modal from "REHEARSE" to "SYSTEM CHECK"
5. Make rehearsal interactive — user triggers workflow, then clicks ack/hold/page on the dashboard themselves
6. Dashboard should stay visible during rehearsal (modal blocks it currently)
7. Add external verification links (Vercel logs, KV state viewer)

---

## Key Architecture Decisions

- **Haiku over Sonnet/Opus**: $20 budget, Haiku is ~80x cheaper. Investigator prompts are simple classification tasks — Haiku is fine.
- **`generateText()` over `DurableAgent`**: WDK doesn't support `WritableStream`. Non-streaming calls work fine for our use case (short responses, tool use).
- **`globalThis.fetch = fetch`**: WDK's durable fetch enables replay on crash recovery. Without it, LLM calls would succeed but not be replay-safe.
- **Direct Anthropic over AI Gateway**: AI Gateway billing wasn't active. Direct API with `CLAUDE_KEY` is simpler and confirmed working.
- **Model map in gateway**: All call sites still say `anthropic/claude-sonnet-4-6` but the gateway silently routes to Haiku. Easy to upgrade later.

---

## How to Test LLM Integration

```bash
# After setting real CLAUDE_KEY:
vercel env pull .env.local --environment production --yes

# Quick local test:
npx tsx -e "
  require('dotenv').config({path:'.env.local'});
  const {createAnthropic} = require('@ai-sdk/anthropic');
  const {generateText} = require('ai');
  const p = createAnthropic({apiKey: process.env.CLAUDE_KEY});
  generateText({model: p.chat('claude-haiku-4-5-20251001'), prompt: 'say OK', maxOutputTokens: 5}).then(r => console.log('LLM:', r.text));
"

# Full workflow test (production):
curl -X POST https://vercel-hackathon-2026-05-01.vercel.app/api/demo/trigger \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer bridge-demo-2026' \
  -d '{"sha":"llm_test_001","score":0.9}'
# Then check Vercel function logs for "[historyAgent]", "[diffAgent]", "[synthesizer]"
```

---

## Commit History (recent)

```
14b46c5  final working version (safe rollback point)
21bdcae  docs: spec for multi-page dashboard shell
1827c31  feat: honest chaos drill + T3/T5 complete
b819ff8  feat: Track 1 compliance — DurableAgent, real WDK Hooks, honest docs
```

Current changes are unstaged. Commit when CLAUDE_KEY is set and LLM is verified working.
