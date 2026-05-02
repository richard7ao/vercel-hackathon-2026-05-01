import { NextRequest, NextResponse } from "next/server";
import { redisGet, redisSet, redisDel, redisScan } from "@/lib/db-redis";

const SECRET = process.env.KV_INTERNAL_SECRET || "bridge-kv-dev";

function auth(req: NextRequest): boolean {
  return req.headers.get("x-kv-secret") === SECRET;
}

export async function GET(req: NextRequest) {
  if (!auth(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const key = req.nextUrl.searchParams.get("key");
  const prefix = req.nextUrl.searchParams.get("prefix");

  if (prefix) {
    const keys = await redisScan(prefix + "*");
    return NextResponse.json({ keys });
  }

  if (!key) return NextResponse.json({ error: "missing key" }, { status: 400 });
  const raw = await redisGet(key);
  return NextResponse.json({ value: raw });
}

export async function POST(req: NextRequest) {
  if (!auth(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { key, value } = await req.json();
  if (!key) return NextResponse.json({ error: "missing key" }, { status: 400 });
  await redisSet(key, typeof value === "string" ? value : JSON.stringify(value));
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  if (!auth(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const key = req.nextUrl.searchParams.get("key");
  if (!key) return NextResponse.json({ error: "missing key" }, { status: 400 });
  await redisDel(key);
  return NextResponse.json({ ok: true });
}
