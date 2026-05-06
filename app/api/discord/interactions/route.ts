import { NextRequest, NextResponse } from "next/server";
import { verifyInteraction } from "@/lib/discord";
import { resumeHook } from "workflow/api";

const MAX_BODY_BYTES = 100_000;

export async function POST(req: NextRequest) {
  const contentLength = parseInt(req.headers.get("content-length") ?? "0", 10);
  if (contentLength > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  }

  const signature = req.headers.get("x-signature-ed25519") ?? "";
  const timestamp = req.headers.get("x-signature-timestamp") ?? "";
  const rawBody = await req.text();

  if (rawBody.length > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  }

  if (!verifyInteraction(rawBody, signature, timestamp)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  const body = JSON.parse(rawBody);

  // Discord PING verification (type 1)
  if (body.type === 1) {
    return NextResponse.json({ type: 1 });
  }

  // Button interaction (type 3 = MESSAGE_COMPONENT)
  if (body.type === 3) {
    const customId: string = body.data?.custom_id ?? "";
    const [action, deployId] = customId.split(":");
    const user = body.member?.user?.username ?? body.user?.username ?? "unknown";

    const userId =
      body.member?.user?.id ?? body.user?.id ?? "unknown";

    const DEPLOY_ID_RE = /^[a-zA-Z0-9_\-]{1,64}$/;
    if (!deployId || !DEPLOY_ID_RE.test(deployId) || !["ack", "hold", "page"].includes(action)) {
      return NextResponse.json({
        type: 4,
        data: { content: "Unknown action." },
      });
    }

    const hookToken = `deploy:ack:${deployId}`;
    const payload = {
      action_type: action,
      user: { id: userId, username: user },
      ts: new Date().toISOString(),
    };

    try {
      await resumeHook(hookToken, payload);
    } catch (err) {
      console.warn("[discord] resumeHook failed:", err);
      return NextResponse.json(
        { error: "deploy not found" },
        { status: 404 }
      );
    }

    const msgs: Record<string, string> = {
      ack: `Acknowledged by ${user}. Workflow resuming.`,
      hold: `Rollback held by ${user}. Deploy paused.`,
      page: `On-call paged by ${user}. Escalating.`,
    };
    const msg = msgs[action] ?? "Action recorded.";

    return NextResponse.json({ type: 4, data: { content: msg } });
  }

  return NextResponse.json({ type: 1 });
}
