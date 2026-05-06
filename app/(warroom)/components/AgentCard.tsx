"use client";

import { useEffect, useRef } from "react";
import type { AgentDef, AgentState } from "../data";
import { useTickedNumber } from "../hooks/useTickedNumber";

export function AgentCard({
  def,
  state,
}: {
  def: AgentDef;
  state: AgentState;
}) {
  const tickedSteps = useTickedNumber(state.steps || 0, 400);
  const tickedTokens = useTickedNumber(state.tokens || 0, 400);
  const streamRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (streamRef.current)
      streamRef.current.scrollTop = streamRef.current.scrollHeight;
  }, [state.lines]);

  const status = state.status;
  const lines = state.lines || [];
  const finding = state.finding;

  return (
    <div className="agent" data-status={status}>
      <div className="agent-head">
        <div className="agent-name">
          <span className="idx">{def.idx}</span>
          {def.name} <span className="role">/ {def.role}</span>
        </div>
        <div className="agent-status">
          <span className="stat-dot" />[ {status.toUpperCase()} ]
        </div>
      </div>

      <div className="agent-meta">
        <span>
          STEPS <span className="v tab-num">{Math.round(tickedSteps)}</span>
        </span>
        <span>
          TOK <span className="v tab-num">{Math.round(tickedTokens)}</span>
        </span>
        <span>
          LAT <span className="v tab-num">{state.latency || "—"}</span>
        </span>
        {state.tool && (
          <span>
            TOOL <span className="v">{state.tool}</span>
          </span>
        )}
      </div>

      <div className="agent-stream" ref={streamRef}>
        {lines.length === 0 && status === "idle" && (
          <div className="line">
            <span className="ts">--:--:--</span>
            <span className="body" style={{ color: "var(--fg-faint)" }}>
              standing by
            </span>
          </div>
        )}
        {lines.map((l, i) => (
          <div key={i} className={"line" + (l.cur ? " cur" : "")}>
            <span className="ts">{l.ts}</span>
            <span className="body">{l.text}</span>
          </div>
        ))}
      </div>

      {finding && (
        <div className="agent-finding">
          <span className={"sev " + finding.severity} />
          <span>{finding.summary}</span>
        </div>
      )}
    </div>
  );
}
