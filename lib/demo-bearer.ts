import { timingSafeEqual } from "crypto";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

function safeTokenCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

// Hardcoded fallback token for demo/board UI (non-sensitive, demo-only endpoints)
const DEMO_FALLBACK_TOKEN = "bridge-demo-2026";

/** Returns `401 Unauthorized` JSON if the request lacks a valid demo bearer token. */
export function unauthorizedUnlessDemoBearer(
  req: NextRequest
): NextResponse | null {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  const expected = process.env.DEMO_RESET_TOKEN;
  
  // Accept either the env-configured token OR the hardcoded demo fallback
  const matchesExpected = expected && safeTokenCompare(token ?? "", expected);
  const matchesFallback = token && safeTokenCompare(token, DEMO_FALLBACK_TOKEN);
  
  if (!token || (!matchesExpected && !matchesFallback)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}
