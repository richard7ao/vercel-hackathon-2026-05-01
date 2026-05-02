"use step";

import {
  type InvestigatorInput,
  type InvestigatorResult,
  emitInvestigatorEvent,
} from "./_base";

export async function runtimeInvestigator(
  input: InvestigatorInput
): Promise<InvestigatorResult> {
  const agent = "runtime";
  const mode = process.env.BRIDGE_MODE ?? "production";

  if (mode !== "demo") {
    const finding = {
      severity: "low" as const,
      summary: "N/A — no observability source connected",
    };
    await emitInvestigatorEvent(input.deploy_id, agent, "complete", undefined, finding);
    return { agent, status: "complete", finding };
  }

  await emitInvestigatorEvent(input.deploy_id, agent, "dispatched");
  await emitInvestigatorEvent(input.deploy_id, agent, "investigating", "metrics.q → CPU/mem baseline");
  await emitInvestigatorEvent(input.deploy_id, agent, "investigating", "metrics.q → request rate anomalies");
  await emitInvestigatorEvent(input.deploy_id, agent, "investigating", "metrics.q → error budget consumption");

  const finding = {
    severity: "medium" as const,
    summary: "No runtime anomalies yet.",
  };
  await emitInvestigatorEvent(input.deploy_id, agent, "complete", undefined, finding);
  return { agent, status: "complete", finding };
}
