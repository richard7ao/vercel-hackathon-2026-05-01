import { NextRequest, NextResponse } from "next/server";
import { execSync } from "child_process";
import { readFileSync } from "fs";
import { resolve } from "path";

export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token || token !== process.env.DEMO_RESET_TOKEN) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    branch?: string;
  };
  const branch = body.branch ?? "demo/exfil";

  try {
    const targetPath = readFileSync(
      resolve(process.cwd(), ".demo-target-path"),
      "utf8"
    ).trim();
    const repoPath = resolve(process.cwd(), targetPath);

    const sha = execSync(`git -C "${repoPath}" rev-parse ${branch}`, {
      encoding: "utf8",
    }).trim();

    execSync(
      `git -C "${repoPath}" checkout main && git -C "${repoPath}" merge --ff-only ${branch}`,
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
    return NextResponse.json(
      { error: "Run failed", detail: String(err) },
      { status: 500 }
    );
  }
}
