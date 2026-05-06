import { kv } from "../db";

type TemporalInput = {
  pushed_at: string;
};

type TemporalResult = {
  off_hours: boolean;
  weekend: boolean;
  rapid_succession: boolean;
  severity: number;
};

const OFFICE_START = parseInt(process.env.OFFICE_HOURS_START ?? "9", 10);
const OFFICE_END = parseInt(process.env.OFFICE_HOURS_END ?? "18", 10);

export async function detectTemporal(
  input: TemporalInput
): Promise<TemporalResult> {
  const dt = new Date(input.pushed_at);
  const hour = dt.getUTCHours();
  const day = dt.getUTCDay();

  const off_hours = hour < OFFICE_START || hour >= OFFICE_END;
  const weekend = day === 0 || day === 6;

  let rapid_succession = false;
  try {
    const keys = await kv.list("deploys:");
    if (keys.length > 0) {
      const latest = await kv.get<{ pushed_at?: string }>(
        keys[keys.length - 1]
      );
      if (latest?.pushed_at) {
        const delta =
          Math.abs(dt.getTime() - new Date(latest.pushed_at).getTime()) / 1000;
        rapid_succession = delta < 60;
      }
    }
  } catch {
    // KV unavailable — skip rapid_succession check
  }

  let severity = 0;
  if (off_hours) severity += 0.3;
  if (weekend) severity += 0.3;
  if (rapid_succession) severity += 0.4;

  return { off_hours, weekend, rapid_succession, severity };
}
