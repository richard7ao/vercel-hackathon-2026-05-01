const DISCORD_API = "https://discord.com/api/v10";

type DiscordMessage = {
  id: string;
  channel_id: string;
  content: string;
  timestamp: string;
};

type Embed = {
  title?: string;
  description?: string;
  color?: number;
  fields?: { name: string; value: string; inline?: boolean }[];
  footer?: { text: string };
  timestamp?: string;
};

type ButtonComponent = {
  type: 2;
  style: 1 | 2 | 3 | 4;
  label: string;
  custom_id: string;
};

type ActionRow = {
  type: 1;
  components: ButtonComponent[];
};

function headers(): Record<string, string> {
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) throw new Error("DISCORD_BOT_TOKEN not set");
  return {
    Authorization: `Bot ${token}`,
    "Content-Type": "application/json",
  };
}

export async function postMessage(
  channelId: string,
  text: string
): Promise<DiscordMessage> {
  const res = await fetch(`${DISCORD_API}/channels/${channelId}/messages`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ content: text }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Discord postMessage failed: ${res.status} ${body}`);
  }
  return res.json() as Promise<DiscordMessage>;
}

export async function postEmbed(
  channelId: string,
  embeds: Embed[],
  components?: ActionRow[]
): Promise<DiscordMessage> {
  const res = await fetch(`${DISCORD_API}/channels/${channelId}/messages`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ embeds, components: components ?? [] }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Discord postEmbed failed: ${res.status} ${body}`);
  }
  return res.json() as Promise<DiscordMessage>;
}

/**
 * Manual war-room ping: @here + embed. Does not use the workflow path (useful when
 * watchdog embeds fail due to env or permissions).
 */
export async function postWarRoomPing(channelId: string): Promise<DiscordMessage> {
  const iso = new Date().toISOString();
  const res = await fetch(`${DISCORD_API}/channels/${channelId}/messages`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      content: `@here **BRIDGE** · manual ping · \`${iso}\``,
      allowed_mentions: { parse: ["everyone"] },
      embeds: [
        {
          title: "Deploy alert path",
          description:
            "Sent from the war room LIVE control. If automatic deploy flags stopped appearing, verify **DISCORD_BOT_TOKEN**, **DISCORD_CHANNEL_ID**, and bot permissions in this channel: **Send Messages**, **Embed Links**, **Attach Files**, and **Use External Apps** / interactions for buttons.",
          color: 0xff8800,
          footer: { text: "Bridge · POST /api/demo/discord-ping" },
          timestamp: iso,
        },
      ],
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Discord postWarRoomPing failed: ${res.status} ${body}`);
  }
  return res.json() as Promise<DiscordMessage>;
}

export function buildPageEmbed(input: {
  deploy_id: string;
  verdict: {
    level: string;
    summary: string;
    concerns: string[];
    suggested_action: string;
  };
}): { embed: Embed; row: ActionRow } {
  const { deploy_id, verdict } = input;

  const colorMap: Record<string, number> = {
    critical: 0xff0000,
    investigate: 0xff8c00,
    watch: 0xffd700,
    benign: 0x00ff00,
  };

  const embed: Embed = {
    title: `BRIDGE ${verdict.level.toUpperCase()} — ${verdict.summary}`,
    color: colorMap[verdict.level] ?? 0xff0000,
    fields: [
      {
        name: "Concerns",
        value: verdict.concerns.map((c) => `• ${c}`).join("\n"),
      },
      { name: "Suggested Action", value: verdict.suggested_action },
    ],
    footer: { text: `deploy: ${deploy_id}` },
    timestamp: new Date().toISOString(),
  };

  const row: ActionRow = {
    type: 1,
    components: [
      {
        type: 2,
        style: 1,
        label: "Acknowledge",
        custom_id: `ack:${deploy_id}`,
      },
      {
        type: 2,
        style: 3,
        label: "Hold Rollback",
        custom_id: `hold:${deploy_id}`,
      },
      {
        type: 2,
        style: 4,
        label: "PAGE ON-CALL",
        custom_id: `page:${deploy_id}`,
      },
    ],
  };

  return { embed, row };
}

export function verifyInteraction(
  rawBody: string,
  signature: string,
  timestamp: string
): boolean {
  const publicKeyHex = process.env.DISCORD_PUBLIC_KEY;
  if (!publicKeyHex) return false;
  try {
    const nodeCrypto = require("crypto") as typeof import("crypto");
    const prefix = Buffer.from("302a300506032b6570032100", "hex");
    const key = nodeCrypto.createPublicKey({
      key: Buffer.concat([prefix, Buffer.from(publicKeyHex, "hex")]),
      format: "der",
      type: "spki",
    });
    return nodeCrypto.verify(
      null,
      Buffer.from(timestamp + rawBody),
      key,
      Buffer.from(signature, "hex")
    );
  } catch (err) {
    console.warn("[discord] signature verification failed:", err);
    return false;
  }
}

export async function respondToInteraction(
  interactionId: string,
  interactionToken: string,
  content: string
): Promise<void> {
  await fetch(
    `${DISCORD_API}/interactions/${interactionId}/${interactionToken}/callback`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: 4,
        data: { content },
      }),
    }
  );
}
