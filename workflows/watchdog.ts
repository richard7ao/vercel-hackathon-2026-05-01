"use workflow";

import { ingest } from "./steps/ingest";

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

  // Steps will be wired in T2.2–T2.6
  return {
    sha,
    score: 0,
    signals: { files: ingestResult.files.length },
    tldr: ingestResult.commit_message,
  };
}
