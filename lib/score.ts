export const WEIGHTS = {
  structural: 0.35,
  behavioral: 0.35,
  temporal: 0.15,
  compounds: 0.15,
} as const;

type ScoreInput = {
  structural?: number | null;
  behavioral?: number | null;
  temporal?: number | null;
  compounds?: number | null;
} | null;

function clamp(v: number | null | undefined): number {
  if (v == null || !Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(1, v));
}

type SignalMap = Record<string, unknown> | null | undefined;

const TRIPLES: [string, string[]][] = [
  ["AUTH_EXFIL_OFFHOURS", ["auth_path", "external_fetch", "off_hours"]],
  ["CRITICAL_NOVEL", ["critical_path", "novel_author"]],
  ["DEP_PAYMENTS", ["new_dependency", "payments_file"]],
];

export function firingTriples(input: { signals: SignalMap }): string[] {
  const s = input?.signals;
  if (!s) return [];
  return TRIPLES.filter(([, keys]) => keys.every((k) => s[k])).map(
    ([name]) => name
  );
}

export function compoundBonus(input: { signals: SignalMap }): number {
  return firingTriples(input).length > 0 ? 1 : 0;
}

export function score(input: ScoreInput): number {
  if (!input) return 0;
  const s = clamp(input.structural);
  const b = clamp(input.behavioral);
  const t = clamp(input.temporal);
  const c = clamp(input.compounds);

  return (
    WEIGHTS.structural * s +
    WEIGHTS.behavioral * b +
    WEIGHTS.temporal * t +
    WEIGHTS.compounds * c
  );
}
