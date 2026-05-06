// KV client — uses fetch to call internal API route.
// Safe for use in WDK workflow/step files (no Buffer/redis dependency).

const MAX_KEY_LENGTH = 256;
const MAX_VALUE_BYTES = 5_000_000;
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

function getBaseUrl(): string {
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return `http://localhost:${process.env.PORT || 3000}`;
}

function headers(): Record<string, string> {
  return {
    "content-type": "application/json",
    "x-kv-secret": process.env.KV_INTERNAL_SECRET || "bridge-kv-dev",
  };
}

export const kv = {
  async set(key: string, value: unknown): Promise<void> {
    validateKey(key);
    const serialized = JSON.stringify(value);
    if (serialized.length > MAX_VALUE_BYTES) {
      throw new Error(
        `Value too large: ${serialized.length} bytes (max ${MAX_VALUE_BYTES})`
      );
    }
    const base = getBaseUrl();
    const res = await fetch(`${base}/api/internal/kv`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ key, value }),
    });
    if (!res.ok) throw new Error(`KV SET failed: ${res.status}`);
  },

  async get<T = unknown>(key: string): Promise<T | null> {
    validateKey(key);
    const base = getBaseUrl();
    const res = await fetch(
      `${base}/api/internal/kv?key=${encodeURIComponent(key)}`,
      { headers: headers() }
    );
    if (!res.ok) throw new Error(`KV GET failed: ${res.status}`);
    const { value } = await res.json();
    if (value === null || value === undefined) return null;
    if (typeof value === "string") {
      try {
        return JSON.parse(value) as T;
      } catch {
        return value as T;
      }
    }
    return value as T;
  },

  async list(prefix: string): Promise<string[]> {
    validateKey(prefix.replace(/\*$/, "") || "a");
    const base = getBaseUrl();
    const res = await fetch(
      `${base}/api/internal/kv?prefix=${encodeURIComponent(prefix)}`,
      { headers: headers() }
    );
    if (!res.ok) throw new Error(`KV LIST failed: ${res.status}`);
    const { keys } = await res.json();
    return keys ?? [];
  },

  async del(key: string): Promise<void> {
    validateKey(key);
    const base = getBaseUrl();
    const res = await fetch(
      `${base}/api/internal/kv?key=${encodeURIComponent(key)}`,
      { method: "DELETE", headers: headers() }
    );
    if (!res.ok) throw new Error(`KV DEL failed: ${res.status}`);
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
