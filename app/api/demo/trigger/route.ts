import { NextRequest, NextResponse } from "next/server";
import { start } from "workflow/api";
import { watchdog } from "@/workflows/watchdog";
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

  const body = (await req.json().catch(() => ({}))) as {
    sha?: string;
    score?: number;
  };

  const sha = body.sha ?? `demo${Date.now().toString(16)}`;
  const score = body.score ?? 0.9;

  try {
    await start(watchdog, [
      {
        sha,
        repo: process.env.MONITORED_REPO ?? "test/repo",
        before: "0".repeat(40),
        after: sha,
        _force_score: score,
      },
    ]);
    return NextResponse.json({ ok: true, sha, score });
  } catch (err) {
    console.error("[demo/trigger]", err);
    return NextResponse.json({ error: "Trigger failed" }, { status: 500 });
  }
}
