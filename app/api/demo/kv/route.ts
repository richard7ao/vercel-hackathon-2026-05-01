import { NextRequest, NextResponse } from "next/server";
import { unauthorizedUnlessDemoBearer } from "@/lib/demo-bearer";
import { redisGet } from "@/lib/db-redis";

/** Read-through for rehearsal UI: same auth as `/api/demo/trigger`, no `x-kv-secret` in the browser. */
export async function GET(req: NextRequest) {
  const auth = unauthorizedUnlessDemoBearer(req);
  if (auth) return auth;

  const key = req.nextUrl.searchParams.get("key");
  if (!key) {
    return NextResponse.json({ error: "missing key" }, { status: 400 });
  }

  const raw = await redisGet(key);
  return NextResponse.json({ value: raw });
}
