export const LEVELS = ["benign", "watch", "investigate", "critical"] as const;
export type Level = (typeof LEVELS)[number];

export const SEVERITY_TO_LEVEL: Record<string, Level> = {
  critical: "critical",
  high: "investigate",
  medium: "watch",
  low: "benign",
};

export function levelIndex(l: Level): number {
  return LEVELS.indexOf(l);
}

export function escalateLevel(current: string, findingSeverity: string): Level {
  const currentLevel = LEVELS.includes(current as Level)
    ? (current as Level)
    : "benign";
  const findingLevel = SEVERITY_TO_LEVEL[findingSeverity] ?? "benign";
  return levelIndex(currentLevel) >= levelIndex(findingLevel)
    ? currentLevel
    : findingLevel;
}
