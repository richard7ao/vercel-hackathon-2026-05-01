import { execSync } from "child_process";
import { readFileSync } from "fs";
import { resolve } from "path";
import {
  detectExternalFetch,
  detectSecretShapes,
  detectAuthPath,
  detectCriticalPath,
  detectNewEndpoint,
} from "../lib/signals/structural";
import {
  detectAuthorPathMismatch,
  detectFileHourNovelty,
  detectCochangeNovelty,
} from "../lib/signals/behavioral";
import { detectTemporal } from "../lib/signals/temporal";
import { score, compoundBonus, firingTriples } from "../lib/score";
import { CRITICAL_PATHS } from "../lib/critical-paths";

type PreviewInput = {
  branch: string;
  skipLLM?: boolean;
};

type SignalEntry = { matched: boolean; severity: number; evidence: unknown[] };

type PreviewResult = {
  score: number;
  verdict_bucket: string;
  signals: {
    structural: Record<string, SignalEntry[]>;
    behavioral: Record<string, SignalEntry[]>;
    temporal: Record<string, unknown>;
    compounds: string[];
  };
};

function getDemoTargetPath(): string {
  const root = resolve(__dirname, "..");
  const raw = readFileSync(resolve(root, ".demo-target-path"), "utf8").trim();
  return resolve(root, raw);
}

type DiffFile = {
  path: string;
  patch: string;
  status: string;
  additions: number;
  deletions: number;
};

function getDiffFiles(repoPath: string, branch: string): DiffFile[] {
  const raw = execSync(
    `git -C "${repoPath}" diff main..${branch} --name-status`,
    { encoding: "utf8" }
  ).trim();
  if (!raw) return [];

  const files: DiffFile[] = [];
  for (const line of raw.split("\n")) {
    const [status, filePath] = line.split("\t");
    if (!filePath) continue;
    const patch = execSync(
      `git -C "${repoPath}" diff main..${branch} -- "${filePath}"`,
      { encoding: "utf8" }
    );
    const additions = patch
      .split("\n")
      .filter((l) => l.startsWith("+") && !l.startsWith("+++")).length;
    const deletions = patch
      .split("\n")
      .filter((l) => l.startsWith("-") && !l.startsWith("---")).length;
    files.push({
      path: filePath,
      patch,
      status: status === "A" ? "added" : status === "D" ? "deleted" : "modified",
      additions,
      deletions,
    });
  }
  return files;
}

function getAuthor(repoPath: string, branch: string): string {
  return execSync(
    `git -C "${repoPath}" log -1 ${branch} --pretty=format:'%ae'`,
    { encoding: "utf8" }
  )
    .replace(/'/g, "")
    .split("@")[0];
}

function getPushedAt(repoPath: string, branch: string): string {
  return execSync(
    `git -C "${repoPath}" log -1 ${branch} --pretty=format:'%aI'`,
    { encoding: "utf8" }
  ).replace(/'/g, "");
}

function bucketFromScore(s: number): string {
  if (s >= 0.8) return "critical";
  if (s >= 0.6) return "investigate";
  if (s >= 0.3) return "watch";
  return "benign";
}

export async function previewStaged(
  input: PreviewInput
): Promise<PreviewResult> {
  const repoPath = getDemoTargetPath();
  const files = getDiffFiles(repoPath, input.branch);
  const author = getAuthor(repoPath, input.branch);
  const pushed_at = getPushedAt(repoPath, input.branch);

  const structural: Record<string, SignalEntry[]> = {};
  const behavioral: Record<string, SignalEntry[]> = {};

  for (const file of files) {
    const ef = detectExternalFetch(file, [
      "*.meridian.internal",
      "api.stripe.com",
    ]);
    if (ef.matched) {
      structural.external_fetch = structural.external_fetch || [];
      structural.external_fetch.push(ef);
    }

    const ss = detectSecretShapes(file);
    if (ss.matched) {
      structural.secret_shapes = structural.secret_shapes || [];
      structural.secret_shapes.push(ss);
    }

    const ap = detectAuthPath(file);
    if (ap.matched) {
      structural.auth_path = structural.auth_path || [];
      structural.auth_path.push(ap);
    }

    const cp = detectCriticalPath(file, CRITICAL_PATHS);
    if (cp.matched) {
      structural.critical_path = structural.critical_path || [];
      structural.critical_path.push(cp);
    }

    const ne = detectNewEndpoint(file);
    if (ne.matched) {
      structural.new_endpoint = structural.new_endpoint || [];
      structural.new_endpoint.push(ne);
    }
  }

  const authorMismatch = await detectAuthorPathMismatch({
    author,
    files: files.map((f) => ({ path: f.path })),
  });
  if (authorMismatch.matched) {
    behavioral.author_path_mismatch = [authorMismatch];
  }

  const hourNovelty = await detectFileHourNovelty({
    files: files.map((f) => ({ path: f.path })),
    pushed_at,
  });
  if (hourNovelty.matched) {
    behavioral.file_hour_novelty = [hourNovelty];
  }

  const cochange = await detectCochangeNovelty({
    files: files.map((f) => ({ path: f.path })),
  });
  if (cochange.matched) {
    behavioral.cochange_novelty = [cochange];
  }

  const temporal = await detectTemporal({ pushed_at });

  const structMax = Math.max(
    0,
    ...Object.values(structural).flatMap((entries) =>
      entries.map((e) => e.severity)
    )
  );
  const behavMax = Math.max(
    0,
    ...Object.values(behavioral).flatMap((entries) =>
      entries.map((e) => e.severity)
    )
  );

  const allSignals: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(structural)) {
    if (v.length > 0) allSignals[k] = v;
  }
  for (const [k, v] of Object.entries(behavioral)) {
    if (v.length > 0) {
      allSignals[k] = v;
      if (k === "author_path_mismatch") allSignals.novel_author = v;
    }
  }
  if (temporal.off_hours) allSignals.off_hours = true;

  const compounds = firingTriples({ signals: allSignals });
  const cb = compoundBonus({ signals: allSignals });

  const finalScore = score({
    structural: structMax,
    behavioral: behavMax,
    temporal: temporal.severity,
    compounds: cb,
  });

  return {
    score: finalScore,
    verdict_bucket: bucketFromScore(finalScore),
    signals: {
      structural,
      behavioral,
      temporal,
      compounds,
    },
  };
}
