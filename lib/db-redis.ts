import { createClient, type RedisClientType } from "redis";

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
