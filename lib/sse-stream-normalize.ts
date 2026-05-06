import { buildDeployRedisRecord } from "./deploy-stream-shape";
import type { DeployEvent } from "./sse-events";

/**
 * Redis payloads are not always stored with a top-level `type` field.
 * Normalize to shapes `parseSSEEvent` / `useDeploysSSE` accept.
 */
export function normalizeStreamPayload(
  key: string,
  record: unknown
): Record<string, unknown> | null {
  if (record === null || typeof record !== "object") return null;
  const r = record as Record<string, unknown>;

  if (typeof r.type === "string") {
    if (r.type === "verdict" && typeof r.deploy_id !== "string") {
      const m = key.match(/^verdicts:(.+)$/);
      if (m) return { ...r, deploy_id: m[1] };
    }
    return r;
  }

  if (key.startsWith("deploys:") && !key.startsWith("deploys:raw:")) {
    const shaFromKey = key.slice("deploys:".length);
    const commitSha =
      typeof r.sha === "string" && r.sha.length > 0 ? r.sha : shaFromKey;
    let tldr: string | undefined;
    if (typeof r.tldr === "string") {
      tldr = r.tldr;
    } else if (typeof r.verdict_bucket === "string") {
      tldr = r.verdict_bucket;
    }
    const built = buildDeployRedisRecord(commitSha, {
      author: typeof r.author === "string" ? r.author : undefined,
      pushed_at: typeof r.pushed_at === "string" ? r.pushed_at : undefined,
      files_changed: Array.isArray(r.files_changed)
        ? (r.files_changed as string[])
        : undefined,
      tldr,
      score: typeof r.score === "number" ? r.score : undefined,
      signals: (r.signals as DeployEvent["signals"]) ?? undefined,
    });
    return built as unknown as Record<string, unknown>;
  }

  if (key.startsWith("verdicts:")) {
    const deploy_id = key.slice("verdicts:".length);
    return { ...r, type: "verdict", deploy_id: deploy_id };
  }

  if (key.startsWith("investigator:")) {
    if (r.type === "investigator") return r;
    const m = key.match(/^investigator:([^:]+):(.+)$/);
    if (!m) return { ...r, type: "investigator" };
    const { type: _t, deploy_id: _d, agent: _a, ...rest } = r;
    return {
      type: "investigator",
      deploy_id: m[1],
      agent: m[2],
      ...rest,
    };
  }

  if (key.startsWith("threats:")) {
    if (r.type === "threat_surface" && Array.isArray(r.items)) return r;
    const id =
      typeof r.id === "string" ? r.id : key.slice("threats:".length);
    const sev = r.severity;
    const severity =
      sev === "low" || sev === "medium" || sev === "high" || sev === "critical"
        ? sev
        : "medium";
    const description =
      typeof r.description === "string" ? r.description : "Threat";
    const age_seconds =
      typeof r.age_seconds === "number" && Number.isFinite(r.age_seconds)
        ? r.age_seconds
        : 0;
    const st = r.status;
    const status =
      st === "open" || st === "acknowledged" || st === "resolved"
        ? st
        : "open";
    return {
      type: "threat_surface",
      items: [{ id, severity, description, age_seconds, status }],
    };
  }

  return null;
}
