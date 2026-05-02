import { NextRequest, NextResponse } from "next/server";
import { execSync } from "child_process";
import { resolve } from "path";

export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token || token !== process.env.DEMO_RESET_TOKEN) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
