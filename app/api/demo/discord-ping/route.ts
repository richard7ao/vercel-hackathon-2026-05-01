import { NextRequest, NextResponse } from "next/server";
import { unauthorizedUnlessDemoBearer } from "@/lib/demo-bearer";
import { postWarRoomPing } from "@/lib/discord";

/**
 * Manual Discord @here + embed from the LIVE war room (same Bearer as other demo routes).
 * Bypasses the watchdog workflow to verify bot token, channel id, and channel permissions.
 */
export async function POST(request: NextRequest) {
  const auth = unauthorizedUnlessDemoBearer(request);
  if (auth) return auth;

  const channelId = process.env.DISCORD_CHANNEL_ID?.trim();
  if (!channelId) {
    return NextResponse.json(
      { error: "DISCORD_CHANNEL_ID is not set" },
      { status: 503 }
    );
  }

  try {
    const msg = await postWarRoomPing(channelId);
    return NextResponse.json({
      ok: true,
      message_id: msg.id,
      channel_id: msg.channel_id,
    });
  } catch (err) {
    console.error("[demo/discord-ping]", err);
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 502 }
    );
  }
}
