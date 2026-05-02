import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { resumeHook } from "workflow/api";

function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  const expected = process.env.DEMO_RESET_TOKEN;
  if (!token || !expected || !safeCompare(token, expected)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    deploy_id?: string;
    action_type?: string;
    username?: string;
  };

  const deployId = body.deploy_id;
  const action = body.action_type ?? "ack";
  const username = body.username ?? "e2e-test";

  if (!deployId || !/^[a-zA-Z0-9_\-]{1,64}$/.test(deployId)) {
    return NextResponse.json({ error: "Invalid deploy_id" }, { status: 400 });
  }

  if (!["ack", "hold", "page"].includes(action)) {
    return NextResponse.json({ error: "Invalid action_type" }, { status: 400 });
  }

  const hookToken = `deploy:ack:${deployId}`;
  const payload = {
    action_type: action,
    user: { id: "e2e", username },
    ts: new Date().toISOString(),
  };

  try {
    await resumeHook(hookToken, payload);
    return NextResponse.json({ ok: true, action, deploy_id: deployId });
  } catch (err) {
    console.warn("[demo/resume] resumeHook failed:", err);
    return NextResponse.json({ error: "Hook not found" }, { status: 404 });
  }
}
