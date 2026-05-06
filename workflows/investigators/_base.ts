import { kvSet, kvGet } from "../steps/kv-ops";

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

export type AgentMemoryEntry = {
  sha: string;
  severity: InvestigatorFinding["severity"];
  summary: string;
  ts: string;
};

const MAX_MEMORY_ENTRIES = 20;

export async function readAgentMemory(
  agent: string,
  author: string
): Promise<AgentMemoryEntry[]> {
  try {
    const raw = await kvGet<AgentMemoryEntry[] | string>(
      `memory:${agent}:${author}`
    );
    if (Array.isArray(raw)) return raw;
    if (typeof raw === "string") return JSON.parse(raw);
  } catch {
    // no memory yet
  }
  return [];
}

export async function writeAgentMemory(
  agent: string,
  author: string,
  finding: InvestigatorFinding,
  sha: string
): Promise<void> {
  try {
    const existing = await readAgentMemory(agent, author);
    const entry: AgentMemoryEntry = {
      sha,
      severity: finding.severity,
      summary: finding.summary,
      ts: new Date().toISOString(),
    };
    const updated = [...existing, entry].slice(-MAX_MEMORY_ENTRIES);
    await kvSet(`memory:${agent}:${author}`, updated);
  } catch (err) {
    console.warn(`[${agent}] memory write failed:`, err);
  }
}

export function formatMemoryContext(memories: AgentMemoryEntry[]): string {
  if (memories.length === 0) return "";
  const recent = memories.slice(-5);
  const lines = recent.map(
    (m) => `  [${m.ts.slice(0, 10)} ${m.severity}] ${m.summary.slice(0, 120)}`
  );
  return `\nPast findings for this author (most recent ${recent.length}):\n${lines.join("\n")}`;
}

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
    await kvSet(`investigator:${deploy_id}:${agent}`, event);
  } catch (err) {
    console.warn(`[investigator:${agent}] KV emit failed:`, err);
  }
}
