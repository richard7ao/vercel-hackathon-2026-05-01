import {
  LEVELS,
  type Level,
  SEVERITY_TO_LEVEL,
  levelIndex,
} from "../lib/verdict-levels";

export type Verdict = {
  level: Level;
  summary: string;
  concerns: string[];
  suggested_action: string;
};

export function derivedVerdict(input: {
  findings: { agent?: string; severity?: string; summary?: string }[];
  signals: Record<string, unknown>;
  score: number;
}): Verdict {
  const { findings, score } = input;

  let findingLevel: Level = "benign";
  for (const f of findings) {
    const mapped = SEVERITY_TO_LEVEL[f.severity ?? "low"] ?? "benign";
    if (levelIndex(mapped) > levelIndex(findingLevel)) {
      findingLevel = mapped;
    }
  }

  const scoreFloor: Level =
    score >= 0.8 ? "investigate" : score >= 0.6 ? "watch" : "benign";

  const level =
    levelIndex(findingLevel) >= levelIndex(scoreFloor)
      ? findingLevel
      : scoreFloor;

  const sorted = [...findings].sort((a, b) => {
    const aIdx = levelIndex(SEVERITY_TO_LEVEL[a.severity ?? "low"] ?? "benign");
    const bIdx = levelIndex(SEVERITY_TO_LEVEL[b.severity ?? "low"] ?? "benign");
    return bIdx - aIdx;
  });

  const concerns: string[] = [];
  for (const f of sorted) {
    if (concerns.length >= 6) break;
    if (f.summary) concerns.push(f.summary);
  }
  if (concerns.length < 3) {
    if (score > 0) concerns.push(`Risk score: ${(score * 100).toFixed(0)}%`);
    if (concerns.length < 3) concerns.push("Review recommended before merge.");
    if (concerns.length < 3) concerns.push("No additional context available.");
  }

  const label = level.charAt(0).toUpperCase() + level.slice(1);
  const topSummary =
    sorted.length > 0 && sorted[0].summary
      ? `${label} — ${sorted[0].summary.slice(0, 120)}`
      : `${label} risk assessment based on score ${(score * 100).toFixed(0)}%.`;

  const actions: Record<Level, string> = {
    critical:
      "Pause deployment immediately and escalate to security team for review.",
    investigate:
      "Hold deployment for manual review before promoting to production.",
    watch: "Proceed with caution; monitor post-deploy metrics closely.",
    benign: "No action required — deploy appears safe.",
  };

  return {
    level,
    summary: topSummary,
    concerns,
    suggested_action: actions[level],
  };
}
