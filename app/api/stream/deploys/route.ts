import { kv } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const encoder = new TextEncoder();
  let lastSeenKeys = new Set<string>();

  const stream = new ReadableStream({
    async start(controller) {
      controller.enqueue(encoder.encode(": connected\n\n"));

      const poll = async () => {
        try {
          const prefixes = [
            { prefix: "deploys:", event: "deploy", exclude: "deploys:raw:" },
            { prefix: "verdicts:", event: "verdict" },
            { prefix: "investigator:", event: "investigator" },
            { prefix: "threats:", event: "threat_surface" },
          ] as const;

          const lists = await Promise.all(
            prefixes.map((p) => kv.list(p.prefix))
          );

          const newKeys: { key: string; event: string }[] = [];
          const allKeys: string[] = [];

          for (let i = 0; i < prefixes.length; i++) {
            const { event, exclude } = prefixes[i] as { event: string; exclude?: string };
            for (const key of lists[i]) {
              if (exclude && key.startsWith(exclude)) continue;
              allKeys.push(key);
              if (!lastSeenKeys.has(key)) {
                newKeys.push({ key, event });
              }
            }
          }

          if (newKeys.length > 0) {
            const records = await Promise.all(
              newKeys.map((nk) => kv.get(nk.key))
            );
            for (let i = 0; i < newKeys.length; i++) {
              if (records[i]) {
                controller.enqueue(
                  encoder.encode(
                    `event: ${newKeys[i].event}\ndata: ${JSON.stringify(records[i])}\n\n`
                  )
                );
              }
            }
          }

          lastSeenKeys = new Set(allKeys);
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
