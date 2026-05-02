#!/usr/bin/env node
/**
 * Smoke-test production demo routes (LLM + Discord ping).
 * Usage:
 *   BRIDGE_TARGET_URL=https://your-app.vercel.app DEMO_RESET_TOKEN=... node scripts/smoke-prod-llm-discord.mjs
 * Or: dotenv loads .env.local when present (no secrets printed).
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const envPath = resolve(root, ".env.local");
if (existsSync(envPath)) {
  const raw = readFileSync(envPath, "utf8");
  for (const line of raw.split("\n")) {
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!m) continue;
    const k = m[1];
    let v = m[2].trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    if (process.env[k] === undefined) process.env[k] = v;
  }
}

const base = (
  process.env.BRIDGE_TARGET_URL ||
  process.env.VERCEL_URL ||
  ""
).replace(/\/$/, "");
const token = process.env.DEMO_RESET_TOKEN || "";

if (!base) {
  console.error("Set BRIDGE_TARGET_URL or VERCEL_URL (https://…)");
  process.exit(1);
}
if (!token) {
  console.error("Set DEMO_RESET_TOKEN");
  process.exit(1);
}

const origin = base.startsWith("http") ? base : `https://${base}`;
const auth = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

async function post(path, body = {}) {
  const url = `${origin}${path}`;
  const res = await fetch(url, { method: "POST", headers: auth, body: JSON.stringify(body) });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text.slice(0, 200) };
  }
  return { ok: res.ok, status: res.status, json };
}

console.log("Target:", origin);

const llm = await post("/api/demo/llm-smoke", {});
console.log("POST /api/demo/llm-smoke", llm.status, llm.json);
if (!llm.ok || !llm.json?.ok) process.exit(2);

const discord = await post("/api/demo/discord-ping", {});
console.log("POST /api/demo/discord-ping", discord.status, discord.json);
if (!discord.ok || !discord.json?.ok) process.exit(3);

console.log("OK — LLM and Discord ping succeeded on production.");
