"use step";

import { redisGet, redisSet, redisDel } from "../../lib/db-redis";
import { postEmbed as discordPostEmbed } from "../../lib/discord";

export async function kvSet(key: string, value: unknown): Promise<void> {
  await redisSet(key, typeof value === "string" ? value : JSON.stringify(value));
}

export async function kvGet<T = unknown>(key: string): Promise<T | null> {
  const raw = await redisGet(key);
  if (raw === null) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return raw as T;
  }
}

export async function kvDel(key: string): Promise<void> {
  await redisDel(key);
}

export async function postDiscordEmbed(
  channelId: string,
  embeds: unknown[],
  components?: unknown[]
): Promise<void> {
  await discordPostEmbed(
    channelId,
    embeds as Parameters<typeof discordPostEmbed>[1],
    components as Parameters<typeof discordPostEmbed>[2]
  );
}
