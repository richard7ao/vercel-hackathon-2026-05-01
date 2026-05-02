# Unresolved Issues

## AI Gateway Unreachable FROM LOCAL MACHINE
- **Status:** Known, acceptable
- **Problem:** `https://gateway.ai.vercel.app` returns ECONNRESET from this local machine. Likely VPN/firewall/ISP blocking the TLS handshake — DNS resolves, but SSL_connect fails.
- **Impact on local dev:** None. Both `summarize.ts` and `synthesizer.ts` have deterministic fallbacks (`mockTldr` and `derivedVerdict`) that produce correct results when the gateway is unreachable.
- **Impact on production:** None. Deployed Vercel functions reach the gateway fine (same network). BUT `AI_GATEWAY_API_KEY` must be set in Vercel project env vars (see below).
- **Files:** `workflows/steps/summarize.ts` (line 43: catch → mockTldr), `workflows/synthesizer.ts` (line 159: catch → derivedVerdict)

## Vercel Project Missing Env Vars
- **Status:** NEEDS ACTION
- **Problem:** Only `REDIS_URL` and `GITHUB_WEBHOOK_SECRET` are set on the Vercel project. The following are missing and must be added via `vercel env add` before the live mode works on the deployed URL:
  - `AI_GATEWAY_API_KEY` — needed for LLM-powered synthesis on production
  - `DISCORD_BOT_TOKEN` — needed for posting verdict embeds
  - `DISCORD_PUBLIC_KEY` — needed for interaction webhook verification
  - `DISCORD_CHANNEL_ID` — needed for targeting the right channel
  - `DEMO_RESET_TOKEN` — needed for the reset API endpoint
- **Not strictly needed on Vercel:**
  - `DISCORD_APPLICATION_ID` — only used locally, not referenced in server code
  - `GITHUB_TOKEN` — only needed for private repos; meridian-core-banking is public
  - `BRIDGE_MODE` — defaults to `production` if unset (correct for deploy)
  - `BUDGET_USD` — defaults to 10 if unset

## Hero Screenshot Missing
- **Status:** NEEDS ACTION (human task)
- **Problem:** `docs/screenshot-critical.png` does not exist. README references it. Take a screenshot of the war room in CRITICAL state during a demo run and save it there (1280px+ wide, PNG).
