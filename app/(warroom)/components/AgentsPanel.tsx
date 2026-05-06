"use client";

import { AGENT_DEFS } from "../data";
import type { AgentState } from "../data";
import { AgentCard } from "./AgentCard";

export function AgentsPanel({
  agents,
}: {
  agents: Record<string, AgentState>;
}) {
  const completed = AGENT_DEFS.filter(
    (d) => agents[d.key]?.status === "complete"
  ).length;
  const investigating = AGENT_DEFS.filter((d) =>
    ["dispatched", "investigating"].includes(agents[d.key]?.status)
  ).length;
  return (
    <div className="panel">
      <div className="panel-header">
        <div className="title">
          <span className="pre">[04]</span> INVESTIGATOR AGENTS{" "}
          <span className="pre">// PARALLEL FAN-OUT</span>
        </div>
        <div className="right">
          <span>
            ACTIVE{" "}
            <span style={{ color: "var(--amber)" }}>{investigating}</span>/5
          </span>
          <span>
            DONE <span style={{ color: "var(--green)" }}>{completed}</span>/5
          </span>
        </div>
      </div>
      <div className="panel-body">
        <div className="agents-grid">
          {AGENT_DEFS.map((def) => (
            <AgentCard
              key={def.key}
              def={def}
              state={
                agents[def.key] || {
                  status: "idle",
                  lines: [],
                  steps: 0,
                  tokens: 0,
                  latency: "—",
                }
              }
            />
          ))}
        </div>
      </div>
    </div>
  );
}
