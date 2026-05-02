import { NextRequest, NextResponse } from "next/server";
import { start } from "workflow/api";
import { watchdog } from "@/workflows/watchdog";
import { unauthorizedUnlessDemoBearer } from "@/lib/demo-bearer";
import { getMonitoredRepo } from "@/lib/monitored-repo";

export async function POST(req: NextRequest) {
  const auth = unauthorizedUnlessDemoBearer(req);
  if (auth) return auth;

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
        repo: getMonitoredRepo(),
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
