import type { Level } from "./verdict-levels";

export type StatusEvent = {
  type: "status";
  state: "all_clear" | "monitoring" | "anomaly" | "critical";
  uptime_seconds: number;
  deploys_analyzed: number;
};

export type DeployEvent = {
  type: "deploy";
  id: string;
  sha: string;
  author: string;
  pushed_at: string;
  files_changed: string[];
  tldr: string;
  score: number;
  signals: {
    structural: string[];
    behavioral: string[];
    temporal: string[];
    compounds: string[];
  };
};

export type InvestigatorEvent = {
  type: "investigator";
  deploy_id: string;
  agent: "trace" | "runtime" | "history" | "dependency" | "diff";
  status: "idle" | "dispatched" | "investigating" | "complete" | "failed";
  current_action?: string;
  finding?: {
    severity: "low" | "medium" | "high" | "critical";
    summary: string;
  };
};

export type FeedEvent = {
  type: "feed";
  deploy_id: string;
  ts: string;
  severity: "info" | "warn" | "critical";
  message: string;
};

export type VerdictEvent = {
  type: "verdict";
  deploy_id: string;
  level: Level;
  summary: string;
  concerns: string[];
  suggested_action: string;
  acknowledged?: boolean;
  acknowledged_by?: string;
  action_taken?: "ack" | "hold" | "page";
};

export type ThreatSurfaceEvent = {
  type: "threat_surface";
  items: Array<{
    id: string;
    severity: "low" | "medium" | "high" | "critical";
    description: string;
    age_seconds: number;
    deploy_id?: string;
    status: "open" | "acknowledged" | "resolved";
  }>;
};

export type SSEEvent =
  | StatusEvent
  | DeployEvent
  | InvestigatorEvent
  | FeedEvent
  | VerdictEvent
  | ThreatSurfaceEvent;

const KNOWN_TYPES = new Set([
  "status",
  "deploy",
  "investigator",
  "feed",
  "verdict",
  "threat_surface",
]);

export function isStatusEvent(e: SSEEvent): e is StatusEvent {
  return e.type === "status";
}
export function isDeployEvent(e: SSEEvent): e is DeployEvent {
  return e.type === "deploy";
}
export function isInvestigatorEvent(e: SSEEvent): e is InvestigatorEvent {
  return e.type === "investigator";
}
export function isFeedEvent(e: SSEEvent): e is FeedEvent {
  return e.type === "feed";
}
export function isVerdictEvent(e: SSEEvent): e is VerdictEvent {
  return e.type === "verdict";
}
export function isThreatSurfaceEvent(e: SSEEvent): e is ThreatSurfaceEvent {
  return e.type === "threat_surface";
}

export function parseSSEEvent(line: string): SSEEvent | null {
  const data = line.startsWith("data: ") ? line.slice(6) : line;
  try {
    const parsed = JSON.parse(data);
    if (!parsed || typeof parsed.type !== "string") return null;
    if (!KNOWN_TYPES.has(parsed.type)) return null;
    return parsed as SSEEvent;
  } catch {
    return null;
  }
}
