"use step";

import {
  type InvestigatorInput,
  type InvestigatorResult,
  emitInvestigatorEvent,
} from "./_base";

export async function traceInvestigator(
  input: InvestigatorInput
): Promise<InvestigatorResult> {
  const agent = "trace";
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
  await emitInvestigatorEvent(input.deploy_id, agent, "investigating", "otlp.query → spans for auth.verify");
  await emitInvestigatorEvent(input.deploy_id, agent, "investigating", "otlp.query → error rate baseline");
  await emitInvestigatorEvent(input.deploy_id, agent, "investigating", "otlp.query → latency P99 comparison");

  const finding = {
    severity: "low" as const,
    summary: "No new error patterns detected in recent traces.",
  };
  await emitInvestigatorEvent(input.deploy_id, agent, "complete", undefined, finding);
  return { agent, status: "complete", finding };
}
