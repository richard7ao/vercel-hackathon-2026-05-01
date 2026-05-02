"use step";

import { Octokit } from "@octokit/rest";

type IngestInput = {
  owner: string;
  repo: string;
  sha: string;
};

export type FileChange = {
  path: string;
  additions: number;
  deletions: number;
  patch: string;
  status: string;
};

export type IngestResult = {
  files: FileChange[];
  commit_message: string;
  author: string;
  pushed_at: string;
};

export async function ingest(input: IngestInput): Promise<IngestResult> {
  const octokit = new Octokit({
    auth: process.env.GITHUB_TOKEN,
  });

  const { data: commit } = await octokit.rest.repos.getCommit({
    owner: input.owner,
    repo: input.repo,
    ref: input.sha,
  });

  const files: FileChange[] = (commit.files ?? []).map((f) => ({
    path: f.filename,
    additions: f.additions,
    deletions: f.deletions,
    patch: f.patch ?? "",
    status: f.status ?? "modified",
  }));

  return {
    files,
    commit_message: commit.commit.message,
    author: commit.commit.author?.name ?? commit.author?.login ?? "unknown",
    pushed_at: commit.commit.committer?.date ?? new Date().toISOString(),
  };
}
