import { timingSafeEqual } from "crypto";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

function safeTokenCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

/** Returns `401 Unauthorized` JSON if the request lacks a valid demo bearer token. */
export function unauthorizedUnlessDemoBearer(
  req: NextRequest
): NextResponse | null {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  const expected = process.env.DEMO_RESET_TOKEN;
  if (!token || !expected || !safeTokenCompare(token, expected)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}
