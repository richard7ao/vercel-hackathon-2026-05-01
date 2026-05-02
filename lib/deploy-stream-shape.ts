import type { DeployEvent } from "./sse-events";

/** Redis value for `deploys:{sha}` — must match `DeployEvent` so `/api/stream/deploys` clients can parse it. */
export function buildDeployRedisRecord(
  sha: string,
  patch: Partial<
    Pick<
      DeployEvent,
      "author" | "pushed_at" | "tldr" | "score" | "files_changed" | "signals"
    >
  > & { verdict_bucket?: string }
): DeployEvent {
  const short = sha.length >= 7 ? sha.slice(0, 7) : sha;
  return {
    type: "deploy",
    id: `dep_${short}`,
    sha,
    author: patch.author ?? "unknown",
    pushed_at: patch.pushed_at ?? new Date().toISOString(),
    files_changed: patch.files_changed ?? [],
    tldr: patch.tldr ?? patch.verdict_bucket ?? "Deploy recorded",
    score: patch.score ?? 0,
    signals: patch.signals ?? {
      structural: [],
      behavioral: [],
      temporal: [],
      compounds: [],
    },
  };
}
