import { kv, setDeploy } from "../lib/db";
import { execSync } from "child_process";
import { createHash } from "crypto";

type SeedOptions = {
  repoPath: string;
  sinceDays: number;
  dryRun?: boolean;
};

type SeedResult = {
  commitsScanned: number;
  commitsWritten: number;
  authorsSeeded: string[];
};

const AUTHORS: Record<
  string,
  { dirs: string[]; weight: number; tenureDays: number }
> = {
  "t-okafor": {
    dirs: ["lib/auth", "lib/auth/permissions.ts", "lib/auth/session.ts"],
    weight: 0.2,
    tenureDays: 365,
  },
  "m-chen": {
    dirs: ["lib/billing", "lib/wires", "lib/wires/transfer.ts"],
    weight: 0.15,
    tenureDays: 280,
  },
  "s-garcia": {
    dirs: ["app/api/wires", "app/api/admin", "lib/compliance"],
    weight: 0.15,
    tenureDays: 200,
  },
  "j-wright": {
    dirs: ["lib/db", "lib/observability"],
    weight: 0.1,
    tenureDays: 400,
  },
  "a-kumar": {
    dirs: ["app/(app)/dashboard", "app/page.tsx", "app/layout.tsx"],
    weight: 0.1,
    tenureDays: 150,
  },
  "dev-3": {
    dirs: ["components/ui"],
    weight: 0.08,
    tenureDays: 14,
  },
  "r-martinez": {
    dirs: ["lib/compliance/aml.ts", "lib/wires/validate.ts"],
    weight: 0.07,
    tenureDays: 90,
  },
  "p-johnson": {
    dirs: [".github", "next.config.ts", "tsconfig.json"],
    weight: 0.05,
    tenureDays: 500,
  },
  "k-lee": {
    dirs: ["app/api/auth", "lib/auth"],
    weight: 0.1,
    tenureDays: 320,
  },
};

function syntheticSha(seed: string): string {
  return createHash("sha256").update(seed).digest("hex").slice(0, 40);
}

function pickFiles(author: string, rng: () => number): string[] {
  const config = AUTHORS[author];
  if (!config) return [];
  const count = 1 + Math.floor(rng() * 4);
  const files: string[] = [];
  for (let i = 0; i < count; i++) {
    const dir = config.dirs[Math.floor(rng() * config.dirs.length)];
    if (dir.includes(".")) {
      files.push(dir);
    } else {
      const suffixes = ["index.ts", "utils.ts", "handler.ts", "config.ts"];
      files.push(`${dir}/${suffixes[Math.floor(rng() * suffixes.length)]}`);
    }
  }
  return [...new Set(files)];
}

function seededRng(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

export async function runSeed(options: SeedOptions): Promise<SeedResult> {
  const { repoPath, sinceDays, dryRun } = options;

  let realCommits: string[] = [];
  try {
    const log = execSync(
      `git -C "${repoPath}" log --format="%H" --since="${sinceDays} days ago"`,
      { encoding: "utf8" }
    ).trim();
    realCommits = log ? log.split("\n") : [];
  } catch {
    realCommits = [];
  }

  const now = Date.now();
  const msPerDay = 86400000;
  const totalDays = sinceDays;
  const commitsPerDay = 3;
  const totalCommits = totalDays * commitsPerDay;

  const authorNames = Object.keys(AUTHORS);
  const authorWeights = authorNames.map((a) => AUTHORS[a].weight);
  const weightSum = authorWeights.reduce((a, b) => a + b, 0);

  let commitsWritten = 0;
  const authorsSeeded = new Set<string>();

  for (let i = 0; i < totalCommits; i++) {
    const rng = seededRng(i * 7919 + 31);
    const daysAgo = Math.floor(i / commitsPerDay);
    const hour = 9 + Math.floor(rng() * 9);
    const minute = Math.floor(rng() * 60);
    const ts = new Date(
      now - daysAgo * msPerDay + (hour - 12) * 3600000 + minute * 60000
    );

    let r = rng() * weightSum;
    let author = authorNames[0];
    for (let j = 0; j < authorNames.length; j++) {
      r -= authorWeights[j];
      if (r <= 0) {
        author = authorNames[j];
        break;
      }
    }

    const sha = syntheticSha(`seed-${i}-${author}-${daysAgo}`);
    const files = pickFiles(author, rng);
    const score = Math.min(1, Math.max(0, rng() * 0.3 + (rng() > 0.92 ? rng() * 0.5 : 0)));

    if (dryRun) {
      authorsSeeded.add(author);
      continue;
    }

    const existing = await kv.get(`deploys:${sha}`);
    if (existing) continue;

    await setDeploy(sha, {
      sha,
      author,
      score,
      pushed_at: ts.toISOString(),
      files_changed: files,
      tldr: `${author}: ${files.length} file(s) in ${files[0]?.split("/")[0] ?? "root"}`,
      seeded: true,
    });

    const authorDirs = await kv.get<string[]>(`history:author:${author}`);
    const dirs = new Set(authorDirs ?? []);
    for (const f of files) {
      const parts = f.split("/");
      if (parts.length > 1) dirs.add(parts.slice(0, -1).join("/"));
    }
    await kv.set(`history:author:${author}`, [...dirs]);

    for (const f of files) {
      const hourHist =
        (await kv.get<number[]>(`history:hour:${f}`)) ?? new Array(24).fill(0);
      hourHist[ts.getUTCHours()] += 1;
      await kv.set(`history:hour:${f}`, hourHist);
    }

    for (let a = 0; a < files.length; a++) {
      for (let b = a + 1; b < files.length; b++) {
        const pair = [files[a], files[b]].sort();
        const key = `history:cochange:${pair[0]}:${pair[1]}`;
        const count = (await kv.get<number>(key)) ?? 0;
        await kv.set(key, count + 1);
      }
    }

    commitsWritten++;
    authorsSeeded.add(author);
  }

  return {
    commitsScanned: totalCommits,
    commitsWritten,
    authorsSeeded: [...authorsSeeded],
  };
}
