#!/usr/bin/env node
/**
 * CLAUDE.md canonical one-liners: Vercel KV /ping + AI Gateway chat/completions.
 * Skips checks when the corresponding env vars are missing (no .env.local in CI).
 */
import { config } from "dotenv";
import { resolve } from "node:path";
import { existsSync } from "node:fs";

const envPath = resolve(process.cwd(), ".env.local");
if (existsSync(envPath)) {
  config({ path: envPath });
} else {
  console.log("verify-canonical: no .env.local — skipping KV + Gateway checks");
  process.exit(0);
}

let ran = 0;
let failed = 0;

async function kvPing() {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) {
    console.log("verify-canonical: SKIP KV (KV_REST_API_URL / KV_REST_API_TOKEN)");
    return;
  }
  ran++;
  const r = await fetch(`${url}/ping`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!r.ok) {
    console.error("verify-canonical: KV /ping", r.status, await r.text());
    failed++;
  } else {
    console.log("verify-canonical: KV /ping OK");
  }
}

async function aiGateway() {
  const key = process.env.AI_GATEWAY_API_KEY;
  if (!key) {
    console.log("verify-canonical: SKIP AI Gateway (AI_GATEWAY_API_KEY)");
    return;
  }
  ran++;
  const r = await fetch("https://gateway.ai.vercel.app/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "anthropic/claude-sonnet-4-6",
      messages: [{ role: "user", content: "reply OK" }],
      max_tokens: 5,
    }),
  });
  if (!r.ok) {
    console.error(
      "verify-canonical: AI Gateway",
      r.status,
      (await r.text()).slice(0, 200)
    );
    failed++;
  } else {
    console.log("verify-canonical: AI Gateway OK");
  }
}

await kvPing();
await aiGateway();

if (ran === 0) {
  console.log("verify-canonical: nothing to run (optional keys absent)");
}
process.exit(failed > 0 ? 1 : 0);
