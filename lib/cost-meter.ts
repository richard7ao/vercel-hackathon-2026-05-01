export const BUDGET_DEFAULTS = {
  budget_usd: 10,
  token_cost: 0.000003,
  step_cost: 0.0001,
};

export type BudgetResult = {
  percent: number;
  severity: "ok" | "amber" | "red";
};

export function computeBudgetRemaining(input: {
  spent_usd: number;
  budget_usd: number;
}): BudgetResult {
  const pct = Math.max(0, ((input.budget_usd - input.spent_usd) / input.budget_usd) * 100);
  const severity: BudgetResult["severity"] =
    pct < 10 ? "red" : pct < 30 ? "amber" : "ok";
  return { percent: pct, severity };
}

export function estimateCost(tokens: number, steps: number): number {
  return tokens * BUDGET_DEFAULTS.token_cost + steps * BUDGET_DEFAULTS.step_cost;
}
