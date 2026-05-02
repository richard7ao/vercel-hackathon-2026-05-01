"use client";

import { useDeploysSSE } from "./hooks/useDeploysSSE";
import { TopBar } from "./components/TopBar";
import { StatusBlock } from "./components/StatusBlock";
import { TimelineRow } from "./components/TimelineRow";
import { AgentsPanel } from "./components/AgentsPanel";
import { FeedPanel } from "./components/FeedPanel";
import { SystemHeatmap } from "./components/SystemHeatmap";
import { ThreatPanel } from "./components/ThreatPanel";
import { VerdictModal } from "./components/VerdictModal";
import { CountdownChip } from "./components/CountdownChip";
import { SuspendedOverlay } from "./components/SuspendedOverlay";
import { ResumePulse } from "./components/ResumePulse";

export default function WarRoom() {
  const data = useDeploysSSE();

  return (
    <div className="shell">
      <TopBar
        activeDeploy={data.activeDeploy}
        mode={data.mode}
        onModeToggle={() =>
          data.setMode(data.mode === "demo" ? "live" : "demo")
        }
      />

      <StatusBlock
        state={data.state}
        uptime={data.uptime}
        deploysAnalyzed={data.deploysAnalyzed}
        agentsStanding={data.agentsStanding}
        mtta={data.mtta}
        score={data.activeDeploy?.score ?? 0}
        budgetPct={data.budgetPct ?? 100}
      />

      <TimelineRow
        deploys={data.deploys}
        activeId={data.activeDeploy?.id ?? null}
        onSelect={data.setActiveDeploy}
      />

      <div className="main-grid">
        <AgentsPanel agents={data.agents} />
        <FeedPanel feed={data.feed} />
        <SystemHeatmap deploys={data.deploys} />
        <ThreatPanel threats={data.threats} />
      </div>

      <VerdictModal
        verdict={data.verdict}
        onClose={() => {
          if (data.verdict && !data.verdict.acknowledged) {
            data.setVerdict({ ...data.verdict, acknowledged: true, acknowledged_by: "you" });
          } else {
            data.setVerdict(null);
          }
        }}
      />

      <div className="demo-ctrl">
        {!data.running && (
          <button className="btn primary" onClick={data.runDemo}>
            ▶ RUN DEMO
          </button>
        )}
        <button className="btn" onClick={data.reset}>
          ↺ RESET
        </button>
      </div>

      {data.loopState === "holding" && (
        <CountdownChip nextPlayInMs={data.nextPlayInMs} />
      )}

      <SuspendedOverlay verdict={data.verdict} />
      <ResumePulse acknowledged={"acknowledged" in (data.verdict ?? {}) && (data.verdict as { acknowledged?: boolean })?.acknowledged === true} />

      <div className="scanlines" />
      <div className="vignette" />
    </div>
  );
}
