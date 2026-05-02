import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";

function verifySignature(body: string, signature: string | null): boolean {
  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  if (!secret || !signature) return false;
  const expected =
    "sha256=" + createHmac("sha256", secret).update(body).digest("hex");
  try {
    return timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expected)
    );
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  const event = req.headers.get("x-github-event");
  const signature = req.headers.get("x-hub-signature-256");

  let body: string;
  try {
    body = await req.text();
    JSON.parse(body);
  } catch {
    return NextResponse.json({ error: "Bad JSON" }, { status: 400 });
  }

  if (!verifySignature(body, signature)) {
    return NextResponse.json({ error: "Bad signature" }, { status: 401 });
  }

  if (event !== "push") {
    return NextResponse.json({ ok: true, skipped: event });
  }

  const payload = JSON.parse(body) as { after?: string };
  const sha = payload.after ?? "unknown";

  // KV write deferred to T1.2.1 (lib/db.ts)
  console.log(`[webhook] push received: sha=${sha}`);

  return NextResponse.json({ ok: true, sha });
}
