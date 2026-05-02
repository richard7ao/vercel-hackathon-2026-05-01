// Key schema:
// deploys:{sha}                  — full deploy record
// deploys:raw:{sha}              — raw webhook payload
// verdicts:{sha}                 — verdict for deploy
// threats:{id}                   — threat surface entry
// history:author:{login}         — set of touched dirs
// history:file:{path}            — file history
// history:cochange:{a}:{b}       — co-change frequency
// history:hour:{path}            — 24-elem array
// pause_state:{deploy_id}        — Discord pause state
// investigator:{deploy_id}:{agent} — agent findings
// workflow_cost:{deploy_id}      — token/cost tracking

import { createClient, type RedisClientType } from "redis";

const MAX_KEY_LENGTH = 256;
const MAX_VALUE_BYTES = 5_000_000; // 5 MB
const VALID_KEY_RE = /^[a-zA-Z0-9_:\-./]+$/;

function validateKey(key: string): void {
  if (!key || key.length > MAX_KEY_LENGTH) {
    throw new Error(`Invalid key length: ${key.length}`);
  }
  if (!VALID_KEY_RE.test(key)) {
    throw new Error(`Invalid key characters: ${key}`);
  }
  if (key.includes("..")) {
    throw new Error(`Path traversal in key: ${key}`);
  }
}

let client: RedisClientType | null = null;

async function getClient(): Promise<RedisClientType> {
  if (client) return client;
  const url = process.env.REDIS_URL;
  if (!url) throw new Error("REDIS_URL not set");
  client = createClient({ url }) as RedisClientType;
  client.on("error", (err) => console.error("[redis]", err));
  await client.connect();
  return client;
}

export const kv = {
  async set(key: string, value: unknown): Promise<void> {
    validateKey(key);
    const serialized = JSON.stringify(value);
    if (serialized.length > MAX_VALUE_BYTES) {
      throw new Error(`Value too large: ${serialized.length} bytes (max ${MAX_VALUE_BYTES})`);
    }
    const c = await getClient();
    await c.set(key, serialized);
  },

  async get<T = unknown>(key: string): Promise<T | null> {
    validateKey(key);
    const c = await getClient();
    const raw = await c.get(key);
    if (raw === null) return null;
    return JSON.parse(raw) as T;
  },

  async list(prefix: string): Promise<string[]> {
    validateKey(prefix.replace(/\*$/, "") || "a");
    const c = await getClient();
    const keys: string[] = [];
    for await (const key of c.scanIterator({
      MATCH: prefix + "*",
      COUNT: 100,
    })) {
      if (Array.isArray(key)) keys.push(...key);
      else keys.push(key as string);
    }
    return keys;
  },

  async del(key: string): Promise<void> {
    validateKey(key);
    const c = await getClient();
    await c.del(key);
  },
};

type DeployRecord = {
  sha: string;
  score?: number;
  tldr?: string;
  author?: string;
  pushed_at?: string;
  files_changed?: string[];
  [key: string]: unknown;
};

export async function setDeploy(
  sha: string,
  record: DeployRecord
): Promise<void> {
  await kv.set("deploys:" + sha, record);
}

export async function getDeploy(sha: string): Promise<DeployRecord | null> {
  return kv.get<DeployRecord>("deploys:" + sha);
}

export async function listDeploys(
  limit: number = 50
): Promise<DeployRecord[]> {
  const keys = await kv.list("deploys:");
  const deployKeys = keys
    .filter((k) => !k.startsWith("deploys:raw:"))
    .slice(0, limit);
  const records = await Promise.all(
    deployKeys.map((key) => kv.get<DeployRecord>(key))
  );
  return records.filter((r): r is DeployRecord => r !== null);
}

export async function getThreat(
  id: string
): Promise<Record<string, unknown> | null> {
  return kv.get("threats:" + id);
}

export async function setThreat(
  id: string,
  record: Record<string, unknown>
): Promise<void> {
  await kv.set("threats:" + id, record);
}
