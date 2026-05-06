import { NextRequest, NextResponse } from "next/server";
import { start } from "workflow/api";
import { unauthorizedUnlessDemoBearer } from "@/lib/demo-bearer";
import {
  injectRehearsalCanary,
  revertRehearsalCanary,
} from "@/lib/git-rehearsal";
import { getMonitoredRepo } from "@/lib/monitored-repo";
import { watchdog } from "@/workflows/watchdog";

function isGithubAuthError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { status?: number; message?: string };
  if (e.status === 401 || e.status === 403 || e.status === 404) return true;
  const msg = (e.message ?? "").toLowerCase();
  return (
    msg.includes("resource not accessible") ||
    msg.includes("bad credentials") ||
    msg.includes("not found") ||
    msg.includes("github_token is required")
  );
}

async function fallbackInject(): Promise<{ sha: string; path: string; mode: "fallback" }> {
  const sha =
    "rehearsal" +
    Date.now().toString(16) +
    Math.random().toString(16).slice(2, 6);
  await start(watchdog, [
    {
      sha,
      repo: getMonitoredRepo(),
      before: "0".repeat(40),
      after: sha,
      _force_score: 0.9,
    },
  ]);
  return {
    sha,
    path: "lib/bridge-rehearsal-canary.ts (simulated — GitHub write disabled)",
    mode: "fallback",
  };
}

/**
 * Git-backed rehearsal: push a canary file to the monitored repo (real webhook →
 * watchdog → agents → hook), then revert by deleting the file for repeatable runs.
 *
 * Fallback: if the GitHub token can't write to the monitored repo (403/401/404),
 * we start the watchdog workflow directly with `_force_score` so the rehearsal UI
 * still gets pause_state → resume → verdicts. The trace label says it's simulated.
 */
export async function POST(req: NextRequest) {
  const auth = unauthorizedUnlessDemoBearer(req);
  if (auth) return auth;

  const body = (await req.json().catch(() => ({}))) as {
    action?: string;
  };
  const action = body.action ?? "inject";

  if (action === "inject") {
    try {
      const { sha, path } = await injectRehearsalCanary();
      return NextResponse.json({ ok: true, action: "inject", sha, path, mode: "git" });
    } catch (err) {
      if (!isGithubAuthError(err)) {
        console.error("[demo/git-rehearsal] non-auth inject error:", err);
        return NextResponse.json(
          { error: err instanceof Error ? err.message : String(err) },
          { status: 500 }
        );
      }
      console.warn(
        "[demo/git-rehearsal] GitHub write blocked — falling back to direct watchdog start"
      );
      try {
        const fb = await fallbackInject();
        return NextResponse.json({ ok: true, action: "inject", ...fb });
      } catch (fbErr) {
        console.error("[demo/git-rehearsal] fallback inject failed:", fbErr);
        return NextResponse.json(
          {
            error:
              fbErr instanceof Error ? fbErr.message : String(fbErr),
            mode: "fallback",
          },
          { status: 500 }
        );
      }
    }
  }

  if (action === "revert") {
    try {
      const { sha, path, noop } = await revertRehearsalCanary();
      return NextResponse.json({ ok: true, action: "revert", sha, path, noop, mode: "git" });
    } catch (err) {
      if (isGithubAuthError(err)) {
        return NextResponse.json({
          ok: true,
          action: "revert",
          noop: true,
          mode: "fallback",
          path: "(simulated — GitHub write disabled)",
        });
      }
      console.error("[demo/git-rehearsal] revert error:", err);
      return NextResponse.json(
        { error: err instanceof Error ? err.message : String(err) },
        { status: 500 }
      );
    }
  }

  return NextResponse.json(
    { error: "Invalid action (use inject | revert)" },
    { status: 400 }
  );
}
