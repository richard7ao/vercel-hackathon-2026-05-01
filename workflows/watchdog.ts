"use workflow";

import { createHook } from "workflow";
import { ingest } from "./steps/ingest";
import { extractSignals } from "./steps/extract-signals";
import { scoreStep } from "./steps/score";
import { summarize } from "./steps/summarize";
import { historyAgent as historyInvestigator } from "./agents/history";
import { dependencyAgent as dependencyInvestigator } from "./agents/dependency";
import { diffAgent as diffInvestigator } from "./agents/diff";
import { traceInvestigator } from "./investigators/trace";
import { runtimeInvestigator } from "./investigators/runtime";
import { synthesize } from "./synthesizer";
import { buildPageEmbed } from "../lib/discord";
import { BRIDGE_REHEARSAL_MARKER } from "../lib/git-rehearsal";
import { buildDeployRedisRecord } from "../lib/deploy-stream-shape";
import { updateHistory } from "../lib/signals/behavioral";
import { kvSet, kvGet, kvDel, postDiscordEmbed } from "./steps/kv-ops";
import { buildSignalName, applyAck, computeTimeoutAt } from "./watchdog-helpers";
import type { InvestigatorInput, InvestigatorResult } from "./investigators/_base";

type WatchdogInput = {
  sha: string;
  repo: string;
  before: string;
  after: string;
  _force_score?: number;
  _force_failure?: string;
};

type WatchdogResult = {
  sha: string;
  score: number;
  verdict_bucket?: string;
  signals?: Record<string, unknown>;
  tldr?: string;
  investigators?: InvestigatorResult[];
  ack?: { action_type: string; user: unknown };
};

type AckPayload = {
  action_type: "ack" | "hold" | "page";
  user: { id: string; username: string };
  ts?: string;
};

const DISPATCH_THRESHOLD = Math.max(
  0,
  Math.min(1, parseFloat(process.env.DISPATCH_THRESHOLD ?? "0.6"))
);

const REHEARSAL_COMMIT_HINT = "bridge rehearsal";

/** Git-backed board/trace rehearsal: floor score + force human gate (GitHub may omit `patch` on some commits). */
function isRehearsalCanaryIngest(ingest: {
  files: { patch?: string }[];
  commit_message: string;
}): boolean {
  if (
    ingest.commit_message.toLowerCase().includes(REHEARSAL_COMMIT_HINT)
  ) {
    return true;
  }
  return ingest.files.some(
    (f) => typeof f.patch === "string" && f.patch.includes(BRIDGE_REHEARSAL_MARKER)
  );
}

async function dispatchInvestigators(
  input: InvestigatorInput,
  finalScore: number
): Promise<InvestigatorResult[]> {
  if (finalScore < DISPATCH_THRESHOLD) return [];

  const mode = process.env.BRIDGE_MODE ?? "production";

  type NamedInvestigator = { name: string; promise: Promise<InvestigatorResult> };

  const investigators: NamedInvestigator[] = [
    { name: "history", promise: historyInvestigator(input) },
    { name: "dependency", promise: dependencyInvestigator(input) },
    { name: "diff", promise: diffInvestigator(input) },
  ];

  if (mode === "demo") {
    investigators.push(
      { name: "trace", promise: traceInvestigator(input) },
      { name: "runtime", promise: runtimeInvestigator(input) },
    );
  }

  const settled = await Promise.allSettled(investigators.map((inv) => inv.promise));
  return settled.map((r, i) => {
    if (r.status === "fulfilled") return r.value;
    const agentName = investigators[i].name;
    console.warn(`[watchdog] investigator ${agentName} failed:`, r.reason);
    return { agent: agentName, status: "failed" as const, finding: undefined };
  });
}

async function synthesizeAndPage(
  sha: string,
  investigators: InvestigatorResult[],
  signals: Record<string, unknown>,
  score: number,
  rehearsalCanary: boolean
): Promise<AckPayload | null> {
  const findings = investigators
    .filter((i) => i.finding)
    .map((i) => ({
      agent: i.agent,
      severity: i.finding!.severity,
      summary: i.finding!.summary,
    }));

  let verdict = await synthesize({
    deploy_id: sha,
    findings,
    signals,
    score,
  });

  // LLM sometimes returns "watch" despite high score; rehearsal would then skip
  // the hook entirely and never write pause_state — board/trace rehearsal times out.
  if (
    rehearsalCanary &&
    verdict.level !== "critical" &&
    verdict.level !== "investigate"
  ) {
    verdict = {
      ...verdict,
      level: "investigate",
      summary: `[rehearsal] ${verdict.summary}`,
      suggested_action:
        verdict.suggested_action ||
        "Hold for review — Bridge git rehearsal (forced investigate for WDK hook).",
    };
  }

  if (verdict.level !== "critical" && verdict.level !== "investigate") {
    return null;
  }

  const channelId = process.env.DISCORD_CHANNEL_ID;
  if (channelId) {
    try {
      const { embed, row } = buildPageEmbed({ deploy_id: sha, verdict });
      await postDiscordEmbed(channelId, [embed], [row]);
    } catch (err) {
      console.warn("[watchdog] Discord embed post failed:", err);
    }
  }

  // WDK Hook — workflow durably suspends here
  const hookToken = buildSignalName(sha);
  const pausedAt = new Date();
  const timeoutAt = computeTimeoutAt(pausedAt);

  const hook = createHook<AckPayload>({ token: hookToken });

  await kvSet(`pause_state:${sha}`, {
    paused_at: pausedAt.toISOString(),
    hook_token: hookToken,
    timeout_at: timeoutAt,
  });

  const ackPayload = await hook;
  hook.dispose();

  const existingVerdict =
    (await kvGet<Record<string, unknown>>(`verdicts:${sha}`)) ?? {};

  const updated = applyAck(existingVerdict, {
    action_type: ackPayload.action_type,
    user: ackPayload.user,
  });
  await kvSet(`verdicts:${sha}`, updated);

  await kvDel(`pause_state:${sha}`);
  return ackPayload;
}

export async function watchdog(input: WatchdogInput): Promise<WatchdogResult> {
  const { sha, repo, _force_score, _force_failure } = input;

  if (_force_failure) {
    throw new Error(`Forced failure: ${_force_failure}`);
  }

  if (_force_score !== undefined) {
    const invInput: InvestigatorInput = {
      deploy_id: sha,
      sha,
      files: [],
    };
    try {
      await kvSet(
        `deploys:${sha}`,
        buildDeployRedisRecord(sha, {
          score: _force_score,
          author: "demo-trigger",
          tldr: `Demo rehearsal · forced score ${_force_score.toFixed(2)}`,
          files_changed: [],
        })
      );
    } catch (err) {
      console.warn("[watchdog] deploy SSE seed failed:", err);
    }

    const investigators = await dispatchInvestigators(invInput, _force_score);

    if (_force_score >= DISPATCH_THRESHOLD && investigators.length > 0) {
      const ackPayload = await synthesizeAndPage(
        sha,
        investigators,
        {},
        _force_score,
        true
      );
      return {
        sha,
        score: _force_score,
        investigators,
        ack: ackPayload ?? undefined,
      };
    }

    return { sha, score: _force_score, investigators };
  }

  const [owner, repoName] = repo.split("/");

  let ingestResult;
  try {
    ingestResult = await ingest({ owner, repo: repoName, sha });
  } catch (err) {
    console.warn("[watchdog] ingest failed:", err);
    return { sha, score: 0 };
  }

  const signals = await extractSignals(ingestResult);

  const { score, verdict_bucket } = await scoreStep({
    ingest: { ...ingestResult, sha },
    signals,
  });

  const rehearsalCanary = isRehearsalCanaryIngest(ingestResult);
  const effectiveScore = rehearsalCanary ? Math.max(score, 0.95) : score;

  const { tldr } = await summarize({
    files: ingestResult.files,
    commit_message: ingestResult.commit_message,
    sha,
  });

  const invInput: InvestigatorInput = {
    deploy_id: sha,
    sha,
    author: ingestResult.author,
    files: ingestResult.files,
  };
  const investigators = await dispatchInvestigators(invInput, effectiveScore);

  try {
    await updateHistory({
      author: ingestResult.author ?? "unknown",
      files: ingestResult.files,
      pushed_at: new Date().toISOString(),
    });
  } catch (err) {
    console.warn("[watchdog] updateHistory failed:", err);
  }

  let ack: AckPayload | null = null;
  if (effectiveScore >= DISPATCH_THRESHOLD && investigators.length > 0) {
    ack = await synthesizeAndPage(
      sha,
      investigators,
      signals as Record<string, unknown>,
      effectiveScore,
      rehearsalCanary
    );
  }

  return {
    sha,
    score: effectiveScore,
    verdict_bucket,
    signals,
    tldr,
    investigators,
    ack: ack ?? undefined,
  };
}
