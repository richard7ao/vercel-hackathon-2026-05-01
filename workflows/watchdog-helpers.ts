const VALID_ACTIONS = new Set(["ack", "hold", "page"]);

const HOLD_DURATION_MINUTES = parseInt(
  process.env.HOLD_DURATION_MINUTES ?? "30",
  10
);

const WDK_PAUSE_MAX_SECONDS = parseInt(
  process.env.WDK_PAUSE_MAX_SECONDS ?? "86400",
  10
);

export function buildSignalName(deploy_id: string): string {
  return `deploy:ack:${deploy_id}`;
}

export function validateAckPayload(payload: unknown): boolean {
  if (!payload || typeof payload !== "object") return false;
  const p = payload as Record<string, unknown>;
  if (!p.action_type || !VALID_ACTIONS.has(p.action_type as string))
    return false;
  if (!p.user || typeof p.user !== "object") return false;
  const u = p.user as Record<string, unknown>;
  if (typeof u.id !== "string" || !u.id) return false;
  if (typeof u.username !== "string") return false;
  return true;
}

export function computeTimeoutAt(now: Date): string {
  return new Date(now.getTime() + WDK_PAUSE_MAX_SECONDS * 1000).toISOString();
}

export function applyAck(
  verdictRec: Record<string, unknown>,
  ack: { action_type: string; user: { id: string; username: string } }
): Record<string, unknown> {
  if (verdictRec.acknowledged_at) return verdictRec;

  const now = new Date().toISOString();
  const base = {
    ...verdictRec,
    acknowledged_at: now,
    acknowledged_by: ack.user.username,
    action_taken: ack.action_type,
  };

  if (ack.action_type === "hold") {
    return {
      ...base,
      held_until: new Date(
        Date.now() + HOLD_DURATION_MINUTES * 60 * 1000
      ).toISOString(),
    };
  }

  if (ack.action_type === "page") {
    return { ...base, paged_at: now };
  }

  return base;
}
