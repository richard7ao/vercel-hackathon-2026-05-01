"use workflow";

import { ingest } from "./steps/ingest";
import { extractSignals } from "./steps/extract-signals";
import { scoreStep } from "./steps/score";
import { summarize } from "./steps/summarize";
import { historyInvestigator } from "./investigators/history";
import { dependencyInvestigator } from "./investigators/dependency";
import { diffInvestigator } from "./investigators/diff";
import { traceInvestigator } from "./investigators/trace";
import { runtimeInvestigator } from "./investigators/runtime";
import { synthesize } from "./synthesizer";
import { buildPageEmbed, postEmbed } from "../lib/discord";
import { kv } from "../lib/db";
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
  action_type: "ack" | "hold" | "page" | "timeout";
  user: { id: string; username: string };
  ts?: string;
};

const DISPATCH_THRESHOLD = Math.max(
  0,
  Math.min(1, parseFloat(process.env.DISPATCH_THRESHOLD ?? "0.6"))
);

const VALID_ACTIONS = new Set(["ack", "hold", "page"]);

export function buildSignalName(deploy_id: string): string {
  return `slack:ack:${deploy_id}`;
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
  const maxSeconds = parseInt(
    process.env.WDK_PAUSE_MAX_SECONDS ?? "86400",
    10
  );
  return new Date(now.getTime() + maxSeconds * 1000).toISOString();
}

async function waitForSignal(
  signalName: string,
  timeoutAt: string
): Promise<AckPayload> {
  const deadline = new Date(timeoutAt).getTime();
  while (Date.now() < deadline) {
    const val = await kv.get<AckPayload>(`signal:${signalName}`);
    if (val) {
      await kv.del(`signal:${signalName}`);
      return val;
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  return {
    action_type: "timeout",
    user: { id: "system", username: "timeout" },
  };
}

export async function sendAck(
  deploy_id: string,
  action_type: string,
  user: { id: string; username?: string }
): Promise<void> {
  const payload = { action_type, user };
  if (!validateAckPayload(payload)) {
    throw new Error(`Invalid ack payload: ${JSON.stringify(payload)}`);
  }
  const signalName = buildSignalName(deploy_id);
  await kv.set(`signal:${signalName}`, {
    ...payload,
    ts: new Date().toISOString(),
  });
}

async function dispatchInvestigators(
  input: InvestigatorInput,
  finalScore: number
): Promise<InvestigatorResult[]> {
  if (finalScore < DISPATCH_THRESHOLD) return [];

  const mode = process.env.BRIDGE_MODE ?? "production";
  const agents =
    mode === "demo"
      ? [
          historyInvestigator(input),
          dependencyInvestigator(input),
          diffInvestigator(input),
          traceInvestigator(input),
          runtimeInvestigator(input),
        ]
      : [
          historyInvestigator(input),
          dependencyInvestigator(input),
          diffInvestigator(input),
        ];

  return Promise.all(agents);
}

async function synthesizeAndPage(
  sha: string,
  investigators: InvestigatorResult[],
  signals: Record<string, unknown>,
  score: number
): Promise<AckPayload | null> {
  const findings = investigators
    .filter((i) => i.finding)
    .map((i) => ({
      agent: i.agent,
      severity: i.finding!.severity,
      summary: i.finding!.summary,
    }));

  const verdict = await synthesize({
    deploy_id: sha,
    findings,
    signals,
    score,
  });

  if (verdict.level !== "critical" && verdict.level !== "investigate") {
    return null;
  }

  const channelId = process.env.DISCORD_CHANNEL_ID;
  if (channelId) {
    try {
      const { embed, row } = buildPageEmbed({ deploy_id: sha, verdict });
      await postEmbed(channelId, [embed], [row]);
    } catch {
      // Discord unavailable
    }
  }

  // WDK signal/wait — workflow pauses here
  const signalName = buildSignalName(sha);
  const pausedAt = new Date();
  const timeoutAt = computeTimeoutAt(pausedAt);

  await kv.set(`pause_state:${sha}`, {
    paused_at: pausedAt.toISOString(),
    expected_signal: signalName,
    timeout_at: timeoutAt,
  });

  return waitForSignal(signalName, timeoutAt);
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
    const investigators = await dispatchInvestigators(invInput, _force_score);

    if (_force_score >= DISPATCH_THRESHOLD && investigators.length > 0) {
      const ackPayload = await synthesizeAndPage(
        sha,
        investigators,
        {},
        _force_score
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
  } catch {
    return { sha, score: 0 };
  }

  const signals = await extractSignals(ingestResult);

  const { score, verdict_bucket } = await scoreStep({
    ingest: { ...ingestResult, sha },
    signals,
  });

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
  const investigators = await dispatchInvestigators(invInput, score);

  let ack: AckPayload | null = null;
  if (score >= DISPATCH_THRESHOLD && investigators.length > 0) {
    ack = await synthesizeAndPage(
      sha,
      investigators,
      signals as Record<string, unknown>,
      score
    );
  }

  return {
    sha,
    score,
    verdict_bucket,
    signals,
    tldr,
    investigators,
    ack: ack ?? undefined,
  };
}

export { buildPageEmbed };
