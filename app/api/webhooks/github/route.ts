import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { kv } from "@/lib/db";

const MAX_BODY_BYTES = 1_000_000; // 1 MB
const SHA_RE = /^[0-9a-f]{7,40}$/;

function sanitizeSha(raw: string | undefined): string {
  if (!raw || !SHA_RE.test(raw)) return "unknown";
  return raw;
}

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
  const contentLength = parseInt(req.headers.get("content-length") ?? "0", 10);
  if (contentLength > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  }

  const event = req.headers.get("x-github-event");
  const signature = req.headers.get("x-hub-signature-256");

  let body: string;
  try {
    body = await req.text();
    if (body.length > MAX_BODY_BYTES) {
      return NextResponse.json({ error: "Payload too large" }, { status: 413 });
    }
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
  const sha = sanitizeSha(payload.after);

  try {
    await kv.set(`deploys:raw:${sha}`, JSON.parse(body));
  } catch (err) {
    console.error("[webhook] KV write failed:", err);
  }

  return NextResponse.json({ ok: true, sha });
}
