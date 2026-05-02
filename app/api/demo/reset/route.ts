import { NextRequest, NextResponse } from "next/server";
import { execSync } from "child_process";
import { existsSync } from "fs";
import { resolve } from "path";
import { timingSafeEqual } from "crypto";

function safeTokenCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  const expected = process.env.DEMO_RESET_TOKEN;
  if (!token || !expected || !safeTokenCompare(token, expected)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const watermark = resolve(process.cwd(), ".demo-watermark");
  if (process.env.VERCEL || !existsSync(watermark)) {
    return NextResponse.json({
      ok: true,
      noop: true,
      reason:
        "KV reset script needs .demo-watermark + local demo repo — not available on this host (e.g. Vercel). Use dashboard KV tools or deploy-specific cleanup.",
    });
  }

  try {
    const scriptPath = resolve(process.cwd(), "scripts/reset-demo.sh");
    execSync(`bash "${scriptPath}"`, {
      encoding: "utf8",
      timeout: 15_000,
      env: { ...process.env },
    });
    return NextResponse.json({ ok: true, reset_at: new Date().toISOString() });
  } catch (err) {
    return NextResponse.json(
      { error: "Reset failed", detail: String(err) },
      { status: 500 }
    );
  }
}
