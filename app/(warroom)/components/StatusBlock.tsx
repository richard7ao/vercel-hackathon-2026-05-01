"use client";

import { useState, useEffect, useRef } from "react";
import { fmtUptime, STATUS_LABELS } from "../data";
import type { StatusState } from "../data";
import { RiskScoreArc } from "./RiskScoreArc";
import { useTickedNumber } from "../hooks/useTickedNumber";

export function StatusBlock({
  state,
  uptime,
  deploysAnalyzed,
  agentsStanding,
  mtta,
  score,
  budgetPct,
}: {
  state: StatusState;
  uptime: number;
  deploysAnalyzed: number;
  agentsStanding: number;
  mtta: string;
  score: number;
  budgetPct: number;
}) {
  const tickedDeploys = useTickedNumber(deploysAnalyzed, 400);
  const tickedBudget = useTickedNumber(budgetPct, 600);
  const budgetColor = tickedBudget < 10 ? "var(--red)" : tickedBudget < 30 ? "var(--amber)" : "var(--fg-dim)";
  const [snap, setSnap] = useState(false);
  const prev = useRef(state);
  useEffect(() => {
    if (prev.current !== state) {
      setSnap(true);
      const t = setTimeout(() => setSnap(false), 240);
      prev.current = state;
      return () => clearTimeout(t);
    }
  }, [state]);

  return (
    <div className={"status-block" + (snap ? " snap" : "")} data-state={state}>
      <span className="corner tl" />
      <span className="corner tr" />
      <span className="corner bl" />
      <span className="corner br" />

      <div className="status-side">
        <div className="kv">
          <span className="k">OPS://</span>
          <span className="v">DEPLOY-MONITOR</span>
        </div>
        <div className="kv">
          <span className="k">CHANNEL</span>
          <span className="v">#deploys &middot; discord</span>
        </div>
        <div className="kv">
          <span className="k">SYNTH</span>
          <span className="v">claude-sonnet-4 &middot; v0.7.2</span>
        </div>
        <div className="kv">
          <span className="k">AGENTS</span>
          <span className="v tab-num">{agentsStanding} STANDING</span>
        </div>
      </div>

      <div className="status-center">
        <div style={{ display: "flex", alignItems: "center", gap: 12, justifyContent: "center" }}>
          <RiskScoreArc score={score} />
          <div>
            <div className={"status-state" + (snap ? " snap" : "")}>
              <span className="bracket">[</span>
              <span className="label">{STATUS_LABELS[state]}</span>
              <span className="bracket">]</span>
            </div>
            <div className="status-sub">
              <span>monitoring</span>
              <span className="sep">&middot;</span>
              <span>
                <span className="tab-num">{Math.round(tickedDeploys)}</span> deploys analyzed
              </span>
              <span className="sep">&middot;</span>
              <span className="tab-num">
                {fmtUptime(uptime)} since last incident
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="status-side right">
        <div className="kv">
          <span className="k">RISK BIAS</span>
          <span className="v">P50 0.11 &middot; P95 0.42</span>
        </div>
        <div className="kv">
          <span className="k">MTTA</span>
          <span className="v tab-num">{mtta}</span>
        </div>
        <div className="kv">
          <span className="k">SSE</span>
          <span className="v">connected &middot; 4ms</span>
        </div>
        <div className="kv">
          <span className="k">BUDGET</span>
          <span className="v tab-num" style={{ color: budgetColor }}>{Math.round(tickedBudget)}% remaining</span>
        </div>
      </div>
    </div>
  );
}
