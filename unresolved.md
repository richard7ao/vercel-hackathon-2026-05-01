# Unresolved Issues

## AI Gateway Unreachable
- **Stage:** T2.6.1 (summarize step)
- **Problem:** `https://gateway.ai.vercel.app` returns ECONNRESET from local machine. All 3 retry attempts fail with "Client network socket disconnected before secure TLS connection was established".
- **Current workaround:** Mock fallback in `workflows/steps/summarize.ts` — returns `"Modified {paths}. {commit_message}."` when gateway call fails.
- **What needs fixing:** Either get AI Gateway working locally (check key validity, network, firewall) or add `@ai-sdk/anthropic` with `ANTHROPIC_API_KEY` as local dev fallback while keeping gateway for deployed Vercel.
- **Constraint at risk:** "All LLM calls go through Vercel AI Gateway" (CLAUDE.md)
- **Files:** `workflows/steps/summarize.ts`, `.env.local` (`AI_GATEWAY_API_KEY`)
