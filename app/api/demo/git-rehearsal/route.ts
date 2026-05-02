import { NextRequest, NextResponse } from "next/server";
import { unauthorizedUnlessDemoBearer } from "@/lib/demo-bearer";
import {
  injectRehearsalCanary,
  revertRehearsalCanary,
} from "@/lib/git-rehearsal";

/**
 * Git-backed rehearsal: push a canary file to the monitored repo (real webhook →
 * watchdog → agents → hook), then revert by deleting the file for repeatable runs.
 */
export async function POST(req: NextRequest) {
  const auth = unauthorizedUnlessDemoBearer(req);
  if (auth) return auth;

  const body = (await req.json().catch(() => ({}))) as {
    action?: string;
  };
  const action = body.action ?? "inject";

  try {
    if (action === "inject") {
      const { sha, path } = await injectRehearsalCanary();
      return NextResponse.json({ ok: true, action: "inject", sha, path });
    }
    if (action === "revert") {
      const { sha, path, noop } = await revertRehearsalCanary();
      return NextResponse.json({ ok: true, action: "revert", sha, path, noop });
    }
    return NextResponse.json(
      { error: "Invalid action (use inject | revert)" },
      { status: 400 }
    );
  } catch (err) {
    console.error("[demo/git-rehearsal]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
