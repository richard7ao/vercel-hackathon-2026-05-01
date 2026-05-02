import { kv } from "../../lib/db";

export type InvestigatorInput = {
  deploy_id: string;
  sha: string;
  author?: string;
  files: { path: string; patch?: string }[];
};

export type InvestigatorFinding = {
  severity: "low" | "medium" | "high" | "critical";
  summary: string;
};

export type InvestigatorResult = {
  agent: string;
  status: "complete" | "failed";
  finding?: InvestigatorFinding;
};

export async function emitInvestigatorEvent(
  deploy_id: string,
  agent: string,
  status: string,
  current_action?: string,
  finding?: InvestigatorFinding
): Promise<void> {
  const event = {
    type: "investigator" as const,
    deploy_id,
    agent,
    status,
    current_action,
    finding,
    ts: new Date().toISOString(),
  };
  try {
    await kv.set(`investigator:${deploy_id}:${agent}`, event);
  } catch (err) {
    console.warn(`[investigator:${agent}] KV emit failed:`, err);
  }
}
