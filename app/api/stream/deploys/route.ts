import { redisGet, redisScan } from "@/lib/db-redis";
import { normalizeStreamPayload } from "@/lib/sse-stream-normalize";

export const dynamic = "force-dynamic";

function eventNameForKey(key: string): string | null {
  if (key.startsWith("deploys:") && !key.startsWith("deploys:raw:")) return "deploy";
  if (key.startsWith("verdicts:")) return "verdict";
  if (key.startsWith("investigator:")) return "investigator";
  if (key.startsWith("threats:")) return "threat_surface";
  return null;
}

export async function GET() {
  const encoder = new TextEncoder();
  const lastPayload = new Map<string, string>();
  let lastStatusSig = "";

  const stream = new ReadableStream({
    async start(controller) {
      controller.enqueue(encoder.encode(": connected\n\n"));

      const poll = async () => {
        try {
          const prefixes = [
            "deploys:",
            "verdicts:",
            "investigator:",
            "threats:",
          ] as const;

          const lists = await Promise.all(
            prefixes.map((p) => redisScan(p + "*"))
          );

          const allKeys = lists.flatMap((keys) =>
            keys.filter((k) => !k.startsWith("deploys:raw:"))
          );

          for (const key of allKeys) {
            const raw = await redisGet(key);
            if (raw === null) continue;
            if (lastPayload.get(key) === raw) continue;
            lastPayload.set(key, raw);

            const evName = eventNameForKey(key);
            if (!evName) continue;

            let parsed: unknown;
            try {
              parsed = JSON.parse(raw);
            } catch {
              continue;
            }

            const normalized = normalizeStreamPayload(key, parsed);
            if (!normalized) continue;

            controller.enqueue(
              encoder.encode(
                `event: ${evName}\ndata: ${JSON.stringify(normalized)}\n\n`
              )
            );
          }

          const deployCount = allKeys.filter(
            (k) =>
              k.startsWith("deploys:") &&
              !k.startsWith("deploys:raw:")
          ).length;
          const statusPayload = {
            type: "status" as const,
            state: deployCount > 0 ? ("monitoring" as const) : ("all_clear" as const),
            uptime_seconds: Math.floor(Date.now() / 1000) % 86_400,
            deploys_analyzed: deployCount,
          };
          const sig = `${statusPayload.state}:${deployCount}`;
          if (sig !== lastStatusSig) {
            lastStatusSig = sig;
            controller.enqueue(
              encoder.encode(
                `event: status\ndata: ${JSON.stringify(statusPayload)}\n\n`
              )
            );
          }
        } catch (err) {
          controller.enqueue(
            encoder.encode(
              `event: error\ndata: ${JSON.stringify({ error: String(err) })}\n\n`
            )
          );
        }
      };

      await poll();

      const interval = setInterval(poll, 1000);

      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": heartbeat\n\n"));
        } catch {
          clearInterval(heartbeat);
          clearInterval(interval);
        }
      }, 15000);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
