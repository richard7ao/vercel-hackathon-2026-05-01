import { NextRequest, NextResponse } from "next/server";
import { execSync } from "child_process";
import { existsSync } from "fs";
import { resolve } from "path";
import { timingSafeEqual } from "crypto";
import { redisScan, redisDel, redisGet } from "@/lib/db-redis";

function safeTokenCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

async function clearKvOnProd(scope: "all" | "agents" = "all"): Promise<{
  deleted: number;
  kept: number;
}> {
  let deleted = 0;
  let kept = 0;

  if (scope === "all") {
    const deployKeys = await redisScan("deploys:*");
    for (const k of deployKeys) {
      if (k.startsWith("deploys:raw:")) {
        kept++;
        continue;
      }
      const raw = await redisGet(k);
      if (raw) {
        try {
          const rec = JSON.parse(raw) as { seeded?: boolean };
          if (rec.seeded) {
            kept++;
            continue;
          }
        } catch {
          /* fall through to delete */
        }
      }
      await redisDel(k);
      deleted++;
    }
  }

  const prefixes =
    scope === "agents"
      ? ["investigator:", "signal:", "pause_state:"]
      : ["verdicts:", "threats:", "investigator:", "pause_state:", "signal:"];

  for (const prefix of prefixes) {
    const keys = await redisScan(prefix + "*");
    for (const k of keys) {
      await redisDel(k);
      deleted++;
    }
  }

  return { deleted, kept };
}

export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  const expected = process.env.DEMO_RESET_TOKEN;
  if (!token || !expected || !safeTokenCompare(token, expected)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as { scope?: string };
  const scope: "all" | "agents" = body.scope === "agents" ? "agents" : "all";

  const vercelHosted =
    process.env.VERCEL_ENV === "production" ||
    process.env.VERCEL_ENV === "preview";

  if (vercelHosted || scope === "agents") {
    try {
      const stats = await clearKvOnProd(scope);
      return NextResponse.json({
        ok: true,
        mode: "kv-only",
        scope,
        reset_at: new Date().toISOString(),
        ...stats,
      });
    } catch (err) {
      return NextResponse.json(
        { error: "KV reset failed", detail: err instanceof Error ? err.message : String(err) },
        { status: 500 }
      );
    }
  }

  const watermark = resolve(process.cwd(), ".demo-watermark");
  const targetPathFile = resolve(process.cwd(), ".demo-target-path");

  if (!existsSync(watermark) || !existsSync(targetPathFile)) {
    try {
      const stats = await clearKvOnProd(scope);
      return NextResponse.json({
        ok: true,
        mode: "kv-only",
        scope,
        reset_at: new Date().toISOString(),
        reason: "No local watermark/target — performed KV-only reset.",
        ...stats,
      });
    } catch (err) {
      return NextResponse.json(
        { error: "KV reset failed", detail: err instanceof Error ? err.message : String(err) },
        { status: 500 }
      );
    }
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
