import { kv, listDeploys } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const encoder = new TextEncoder();
  let lastSeenKeys = new Set<string>();

  const stream = new ReadableStream({
    async start(controller) {
      controller.enqueue(encoder.encode(": connected\n\n"));

      const poll = async () => {
        try {
          const deployKeys = await kv.list("deploys:");
          const currentKeys = new Set(
            deployKeys.filter((k) => !k.startsWith("deploys:raw:"))
          );

          for (const key of currentKeys) {
            if (!lastSeenKeys.has(key)) {
              const record = await kv.get(key);
              if (record) {
                controller.enqueue(
                  encoder.encode(
                    `event: deploy\ndata: ${JSON.stringify(record)}\n\n`
                  )
                );
              }
            }
          }

          const verdictKeys = await kv.list("verdicts:");
          for (const key of verdictKeys) {
            if (!lastSeenKeys.has(key)) {
              const record = await kv.get(key);
              if (record) {
                controller.enqueue(
                  encoder.encode(
                    `event: verdict\ndata: ${JSON.stringify(record)}\n\n`
                  )
                );
              }
            }
          }

          const threatKeys = await kv.list("threats:");
          for (const key of threatKeys) {
            if (!lastSeenKeys.has(key)) {
              const record = await kv.get(key);
              if (record) {
                controller.enqueue(
                  encoder.encode(
                    `event: threat_surface\ndata: ${JSON.stringify(record)}\n\n`
                  )
                );
              }
            }
          }

          lastSeenKeys = new Set([
            ...currentKeys,
            ...(await kv.list("verdicts:")),
            ...(await kv.list("threats:")),
          ]);
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

      const cleanup = () => clearInterval(interval);
      controller.enqueue(encoder.encode(""));

      // Keep connection alive with heartbeat
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": heartbeat\n\n"));
        } catch {
          clearInterval(heartbeat);
          cleanup();
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
