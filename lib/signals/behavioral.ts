import { kv } from "../db";

type DetectResult = {
  matched: boolean;
  severity: number;
  evidence: string[];
};

type AuthorPathInput = {
  author: string;
  files: { path: string }[];
};

type FileHourInput = {
  files: { path: string }[];
  pushed_at: string;
};

export async function detectAuthorPathMismatch(
  input: AuthorPathInput
): Promise<DetectResult> {
  const key = `history:author:${input.author}`;
  let knownDirs: string[] = [];

  try {
    const raw = await kv.get<string[] | string>(key);
    if (Array.isArray(raw)) knownDirs = raw;
    else if (typeof raw === "string") knownDirs = JSON.parse(raw);
  } catch {
    // KV unavailable — treat as unknown author
  }

  if (knownDirs.length === 0) {
    return {
      matched: true,
      severity: 0.5,
      evidence: ["no history for author"],
    };
  }

  const novelDirs: string[] = [];
  for (const file of input.files) {
    const dir = file.path.split("/").slice(0, -1).join("/");
    if (!knownDirs.some((known) => dir.startsWith(known))) {
      novelDirs.push(dir);
    }
  }

  if (novelDirs.length === 0) {
    return { matched: false, severity: 0, evidence: [] };
  }

  const severity = Math.min(0.6 + novelDirs.length * 0.2, 1.0);
  return { matched: true, severity, evidence: novelDirs };
}

export async function detectFileHourNovelty(
  input: FileHourInput
): Promise<DetectResult> {
  const hour = new Date(input.pushed_at).getUTCHours();
  const novelFiles: string[] = [];

  for (const file of input.files) {
    const key = `history:hour:${file.path}`;
    try {
      const raw = await kv.get<number[] | string>(key);
      const counts = Array.isArray(raw)
        ? raw
        : typeof raw === "string"
          ? JSON.parse(raw)
          : null;
      if (counts && counts[hour] === 0) {
        novelFiles.push(file.path);
      } else if (!counts) {
        novelFiles.push(file.path);
      }
    } catch {
      // KV unavailable — skip
    }
  }

  if (novelFiles.length === 0) {
    return { matched: false, severity: 0, evidence: [] };
  }

  const severity = Math.min(0.3 + novelFiles.length * 0.1, 0.8);
  return { matched: true, severity, evidence: novelFiles };
}

export async function detectCochangeNovelty(input: {
  files: { path: string }[];
}): Promise<DetectResult> {
  if (input.files.length < 2) {
    return { matched: false, severity: 0, evidence: [] };
  }

  const novelPairs: string[] = [];
  const paths = input.files.map((f) => f.path).sort();

  for (let i = 0; i < paths.length; i++) {
    for (let j = i + 1; j < paths.length; j++) {
      const key = `history:cochange:${paths[i]}:${paths[j]}`;
      try {
        const count = await kv.get<number | string>(key);
        const n = typeof count === "string" ? Number(count) : count;
        if (!n || n === 0) {
          novelPairs.push(`${paths[i]}+${paths[j]}`);
        }
      } catch {
        novelPairs.push(`${paths[i]}+${paths[j]}`);
      }
    }
  }

  if (novelPairs.length === 0) {
    return { matched: false, severity: 0, evidence: [] };
  }

  const severity = Math.min(0.3 + novelPairs.length * 0.1, 0.8);
  return { matched: true, severity, evidence: novelPairs };
}

type UpdateHistoryInput = {
  author: string;
  files: { path: string }[];
  pushed_at: string;
};

export async function updateHistory(input: UpdateHistoryInput): Promise<void> {
  const hour = new Date(input.pushed_at).getUTCHours();
  const dirs = new Set<string>();
  const paths = input.files.map((f) => f.path).sort();

  for (const file of input.files) {
    const dir = file.path.split("/").slice(0, -1).join("/");
    if (dir) dirs.add(dir);
  }

  // Update author history
  const authorKey = `history:author:${input.author}`;
  try {
    const existing = await kv.get<string[] | string>(authorKey);
    const current = Array.isArray(existing)
      ? existing
      : typeof existing === "string"
        ? JSON.parse(existing)
        : [];
    const merged = [...new Set([...current, ...dirs])];
    await kv.set(authorKey, merged);
  } catch {
    await kv.set(authorKey, [...dirs]);
  }

  // Update hour histograms
  for (const file of input.files) {
    const hourKey = `history:hour:${file.path}`;
    try {
      const existing = await kv.get<number[] | string>(hourKey);
      const counts = Array.isArray(existing)
        ? existing
        : typeof existing === "string"
          ? JSON.parse(existing)
          : new Array(24).fill(0);
      counts[hour] = (counts[hour] || 0) + 1;
      await kv.set(hourKey, counts);
    } catch {
      const counts = new Array(24).fill(0);
      counts[hour] = 1;
      await kv.set(hourKey, counts);
    }
  }

  // Update co-change counts
  for (let i = 0; i < paths.length; i++) {
    for (let j = i + 1; j < paths.length; j++) {
      const ccKey = `history:cochange:${paths[i]}:${paths[j]}`;
      try {
        const existing = await kv.get<number | string>(ccKey);
        const n = typeof existing === "string" ? Number(existing) : existing;
        await kv.set(ccKey, (n || 0) + 1);
      } catch {
        await kv.set(ccKey, 1);
      }
    }
  }
}
