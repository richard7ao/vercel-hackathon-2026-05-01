export type Area = "api" | "web" | "workers" | "data" | "infra" | "third";

export type Classification = {
  area: Area;
  subarea: string | null;
  is_critical: boolean;
};

type Rule = {
  pattern: RegExp;
  area: Area;
  subarea: string | null;
  critical: boolean;
};

const RULES: Rule[] = [
  { pattern: /^app\/api\/auth/,            area: "api",      subarea: "auth",       critical: true },
  { pattern: /^app\/api\/payments/,        area: "api",      subarea: "payments",   critical: true },
  { pattern: /^app\/api\/admin/,           area: "api",      subarea: "admin",      critical: true },
  { pattern: /^app\/api\/.+\/webhooks/,    area: "api",      subarea: "webhooks",   critical: false },
  { pattern: /^app\/api\/cron/,            area: "workers",  subarea: "cron",       critical: false },
  { pattern: /^app\/api\//,                area: "api",      subarea: "public",     critical: false },
  { pattern: /^lib\/auth/,                 area: "api",      subarea: "auth",       critical: true },
  { pattern: /^app\/\(.+\)/,              area: "web",      subarea: null,         critical: false },
  { pattern: /^components\//,              area: "web",      subarea: "components", critical: false },
  { pattern: /^workflows\//,              area: "workers",  subarea: "workflows",  critical: false },
  { pattern: /\/(db|prisma|drizzle)\//,   area: "data",     subarea: "schemas",    critical: false },
  { pattern: /^lib\/db\//,                area: "data",     subarea: "queries",    critical: false },
  { pattern: /migrations\//,              area: "data",     subarea: "migrations", critical: false },
  { pattern: /middleware/,                area: "infra",    subarea: "middleware",  critical: false },
  { pattern: /^\.env|next\.config/,       area: "infra",    subarea: "env",        critical: false },
  { pattern: /^\.github\/|vercel\.(json|ts)$/, area: "infra", subarea: "ci",      critical: false },
];

export function classify(path: string): Classification {
  for (const rule of RULES) {
    if (rule.pattern.test(path)) {
      return { area: rule.area, subarea: rule.subarea, is_critical: rule.critical };
    }
  }
  return { area: "third", subarea: null, is_critical: false };
}

type DeployInput = {
  score: number;
  files_changed: string[];
};

type AreaAgg = {
  score: number;
  file_count: number;
  top_subareas: string[];
};

export function aggregateAreas(
  deploys: DeployInput[]
): Record<Area, AreaAgg> {
  const ALL_AREAS: Area[] = ["api", "web", "workers", "data", "infra", "third"];
  const buckets: Record<Area, { scores: number[]; subareas: Map<string, number> }> = {} as never;
  for (const a of ALL_AREAS) {
    buckets[a] = { scores: [], subareas: new Map() };
  }

  for (const deploy of deploys) {
    for (const file of deploy.files_changed) {
      const c = classify(file);
      buckets[c.area].scores.push(deploy.score);
      if (c.subarea) {
        const count = buckets[c.area].subareas.get(c.subarea) ?? 0;
        buckets[c.area].subareas.set(c.subarea, count + 1);
      }
    }
  }

  const result: Record<string, AreaAgg> = {};
  for (const area of ALL_AREAS) {
    const { scores, subareas } = buckets[area];
    const maxScore = scores.length > 0 ? Math.max(...scores) : 0;
    const meanScore =
      scores.length > 0
        ? scores.reduce((a, b) => a + b, 0) / scores.length
        : 0;
    const areaScore = 0.6 * maxScore + 0.4 * meanScore;

    const top = [...subareas.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([name]) => name);

    result[area] = {
      score: areaScore,
      file_count: scores.length,
      top_subareas: top,
    };
  }

  return result as Record<Area, AreaAgg>;
}
