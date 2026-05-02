import { NextRequest, NextResponse } from "next/server";
import { verifyInteraction, respondToInteraction } from "@/lib/discord";
import { kv } from "@/lib/db";

export async function POST(req: NextRequest) {
  const signature = req.headers.get("x-signature-ed25519") ?? "";
  const timestamp = req.headers.get("x-signature-timestamp") ?? "";
  const rawBody = await req.text();

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

    if (!deployId || !["ack", "hold"].includes(action)) {
      return NextResponse.json({
        type: 4,
        data: { content: "Unknown action." },
      });
    }

    const ts = new Date().toISOString();

    await kv.set(`pause_state:${deployId}`, {
      action,
      user,
      ts,
    });

    await kv.set(`signal:slack:ack:${deployId}`, {
      action_type: action,
      user: { id: userId, username: user },
      ts,
    });

    const msg =
      action === "ack"
        ? `Acknowledged by ${user}. Workflow resuming.`
        : `Rollback held by ${user}. Deploy paused.`;

    return NextResponse.json({ type: 4, data: { content: msg } });
  }

  return NextResponse.json({ type: 1 });
}
