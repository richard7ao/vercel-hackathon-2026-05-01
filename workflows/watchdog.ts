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
};

const DISPATCH_THRESHOLD = Math.max(
  0,
  Math.min(1, parseFloat(process.env.DISPATCH_THRESHOLD ?? "0.6"))
);

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

  if (score >= DISPATCH_THRESHOLD && investigators.length > 0) {
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
      signals: signals as Record<string, unknown>,
      score,
    });

    if (verdict.level === "critical" || verdict.level === "investigate") {
      const channelId = process.env.DISCORD_CHANNEL_ID;
      if (channelId) {
        try {
          const { embed, row } = buildPageEmbed({
            deploy_id: sha,
            verdict,
          });
          await postEmbed(channelId, [embed], [row]);
        } catch {
          // Discord unavailable — continue without page
        }
      }
    }
  }

  return { sha, score, verdict_bucket, signals, tldr, investigators };
}

export { buildPageEmbed };
