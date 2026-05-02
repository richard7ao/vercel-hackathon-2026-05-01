"use step";

import { kv } from "../../lib/db";
import { postEmbed as discordPostEmbed } from "../../lib/discord";

export async function kvSet(key: string, value: unknown): Promise<void> {
  await kv.set(key, value);
}

export async function kvGet<T = unknown>(key: string): Promise<T | null> {
  return kv.get<T>(key);
}

export async function kvDel(key: string): Promise<void> {
  await kv.del(key);
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
