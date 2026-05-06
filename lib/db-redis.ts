if (typeof (globalThis as { Buffer?: unknown }).Buffer === "undefined") {
  (globalThis as { Buffer?: unknown }).Buffer = Uint8Array;
}

type RedisClientLike = {
  connect(): Promise<unknown>;
  on(event: string, cb: (err: unknown) => void): unknown;
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<unknown>;
  del(key: string): Promise<unknown>;
  scanIterator(opts: { MATCH: string; COUNT?: number }): AsyncIterable<string | string[]>;
};

let client: RedisClientLike | null = null;

async function getClient(): Promise<RedisClientLike> {
  if (client) return client;
  const url = process.env.REDIS_URL;
  if (!url) throw new Error("REDIS_URL not set");
  // Lazy-load redis so the Buffer shim above is already in place when
  // @redis/client/dist/lib/RESP/decoder.js evaluates `Buffer` at module load.
  const mod = (await import("redis")) as {
    createClient: (opts: { url: string }) => RedisClientLike;
  };
  client = mod.createClient({ url });
  client.on("error", (err) => console.error("[redis]", err));
  await client.connect();
  return client;
}

export async function redisGet(key: string): Promise<string | null> {
  const c = await getClient();
  return c.get(key);
}

export async function redisSet(key: string, value: string): Promise<void> {
  const c = await getClient();
  await c.set(key, value);
}

export async function redisDel(key: string): Promise<void> {
  const c = await getClient();
  await c.del(key);
}

export async function redisScan(pattern: string): Promise<string[]> {
  const c = await getClient();
  const keys: string[] = [];
  for await (const key of c.scanIterator({ MATCH: pattern, COUNT: 100 })) {
    if (Array.isArray(key)) keys.push(...key);
    else keys.push(key as string);
  }
  return keys;
}
