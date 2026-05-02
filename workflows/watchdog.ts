"use workflow";

import { ingest } from "./steps/ingest";
import { extractSignals } from "./steps/extract-signals";
import { scoreStep } from "./steps/score";
import { summarize } from "./steps/summarize";

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
};

export async function watchdog(input: WatchdogInput): Promise<WatchdogResult> {
  const { sha, repo, _force_score, _force_failure } = input;

  if (_force_failure) {
    throw new Error(`Forced failure: ${_force_failure}`);
  }

  if (_force_score !== undefined) {
    return { sha, score: _force_score };
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

  return { sha, score, verdict_bucket, signals, tldr };
}
