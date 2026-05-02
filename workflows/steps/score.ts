"use step";

import { score, compoundBonus } from "../../lib/score";
import { redisSet } from "../../lib/db-redis";
import { buildDeployRedisRecord } from "../../lib/deploy-stream-shape";

type ScoreInput = {
  ingest: {
    sha?: string;
    files: unknown[];
    author: string;
    pushed_at: string;
  };
  signals: {
    structural?: Record<string, unknown>;
    behavioral?: Record<string, unknown>;
    temporal?: Record<string, unknown>;
  };
};

function maxSeverity(group: Record<string, unknown>): number {
  let max = 0;
  for (const hits of Object.values(group)) {
    if (!Array.isArray(hits)) continue;
    for (const h of hits) {
      if (!h || typeof h !== "object" || !("severity" in h)) continue;
      const sev = (h as Record<string, unknown>).severity;
      if (typeof sev === "number" && sev > max) max = sev;
    }
  }
  return max;
}

function bucket(s: number): string {
  if (s >= 0.8) return "critical";
  if (s >= 0.6) return "investigate";
  if (s >= 0.3) return "watch";
  return "benign";
}

function buildSignalFlags(signals: ScoreInput["signals"]): Record<string, boolean> {
  const flags: Record<string, boolean> = {};
  if (signals.structural) {
    for (const [key, hits] of Object.entries(signals.structural)) {
      if (Array.isArray(hits) && hits.length > 0) flags[key] = true;
    }
  }
  if (signals.temporal) {
    for (const [key, val] of Object.entries(signals.temporal)) {
      if (val === true) flags[key] = true;
    }
  }
  return flags;
}

export async function scoreStep(input: ScoreInput) {
  const temporalRecord =
    (input.signals.temporal ?? {}) as Record<string, unknown>;
  const temporalSev =
    typeof temporalRecord.severity === "number" ? temporalRecord.severity : 0;

  const structural = maxSeverity(input.signals.structural ?? {});
  const behavioral = maxSeverity(
    (input.signals.behavioral ?? {}) as Record<string, { severity: number }[]>
  );

  const signalFlags = buildSignalFlags(input.signals);
  const compounds = compoundBonus({ signals: signalFlags });

  const finalScore = score({
    structural,
    behavioral,
    temporal: temporalSev,
    compounds,
  });

  const verdict_bucket = bucket(finalScore);

  if (input.ingest.sha) {
    try {
      const paths = (input.ingest.files as { path: string }[]).map((f) => f.path);
      const structKeys = Object.entries(input.signals.structural ?? {})
        .filter(([, v]) => Array.isArray(v) && v.length > 0)
        .map(([k]) => k);
      const behKeys = Object.keys(input.signals.behavioral ?? {});
      const tempKeys =
        typeof temporalRecord.severity === "number" ? ["temporal"] : [];
      const record = buildDeployRedisRecord(input.ingest.sha, {
        score: finalScore,
        author: input.ingest.author,
        pushed_at: input.ingest.pushed_at,
        files_changed: paths,
        tldr: `${verdict_bucket.toUpperCase()} · scoring complete`,
        signals: {
          structural: structKeys,
          behavioral: behKeys,
          temporal: tempKeys,
          compounds: compounds > 0 ? [`compound:${compounds}`] : [],
        },
      });
      await redisSet(`deploys:${input.ingest.sha}`, JSON.stringify(record));
    } catch (err) {
      console.warn("[score] KV update failed:", err);
    }
  }

  return { score: finalScore, verdict_bucket };
}
