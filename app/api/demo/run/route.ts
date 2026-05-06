import { NextRequest, NextResponse } from "next/server";
import { execSync } from "child_process";
import { readFileSync } from "fs";
import { resolve } from "path";
import { timingSafeEqual } from "crypto";

const BRANCH_RE = /^[a-zA-Z0-9_\-./]{1,128}$/;
const ALLOWED_BRANCHES = ["demo/exfil", "demo/privesc", "demo/leak"];

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
    branch?: string;
  };
  const branch = body.branch ?? "demo/exfil";

  if (!BRANCH_RE.test(branch) || !ALLOWED_BRANCHES.includes(branch)) {
    return NextResponse.json({ error: "Invalid branch" }, { status: 400 });
  }

  try {
    const targetPath = readFileSync(
      resolve(process.cwd(), ".demo-target-path"),
      "utf8"
    ).trim();
    const repoPath = resolve(process.cwd(), targetPath);

    const sha = execSync(`git -C "${repoPath}" rev-parse "${branch}"`, {
      encoding: "utf8",
    }).trim();

    execSync(
      `git -C "${repoPath}" checkout main && git -C "${repoPath}" merge --ff-only "${branch}"`,
      { encoding: "utf8", timeout: 10_000 }
    );

    if (execSync(`git -C "${repoPath}" remote get-url origin 2>/dev/null || echo ""`, { encoding: "utf8" }).trim()) {
      execSync(`git -C "${repoPath}" push origin main`, {
        encoding: "utf8",
        timeout: 10_000,
      });
    }

    return NextResponse.json({ ok: true, branch, sha, merged: true });
  } catch (err) {
    console.error("[demo/run]", err);
    return NextResponse.json(
      { error: "Run failed" },
      { status: 500 }
    );
  }
}
