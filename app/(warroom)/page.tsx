"use client";

import { useDeploysSSE } from "./hooks/useDeploysSSE";
import { TopBar } from "./components/TopBar";
import { StatusBlock } from "./components/StatusBlock";
import { TimelineRow } from "./components/TimelineRow";
import { AgentsPanel } from "./components/AgentsPanel";
import { FeedPanel } from "./components/FeedPanel";
import { HeatmapPanel } from "./components/HeatmapPanel";
import { ThreatPanel } from "./components/ThreatPanel";
import { VerdictModal } from "./components/VerdictModal";
import { CountdownChip } from "./components/CountdownChip";

export default function WarRoom() {
  const data = useDeploysSSE();

  return (
    <div className="shell">
      <TopBar activeDeploy={data.activeDeploy} />

      <StatusBlock
        state={data.state}
        uptime={data.uptime}
        deploysAnalyzed={data.deploysAnalyzed}
        agentsStanding={data.agentsStanding}
        mtta={data.mtta}
      />

      <TimelineRow
        deploys={data.deploys}
        activeId={data.activeDeploy?.id ?? null}
        onSelect={data.setActiveDeploy}
      />

      <div className="main-grid">
        <AgentsPanel agents={data.agents} />
        <FeedPanel feed={data.feed} />
        <HeatmapPanel grid={data.heatmap} peakCell={data.peakCell} />
        <ThreatPanel threats={data.threats} />
      </div>

      <VerdictModal
        verdict={data.verdict}
        onClose={() => data.setVerdict(null)}
      />

      <div className="demo-ctrl">
        {"mode" in data && (
          <button
            className="btn"
            onClick={() =>
              data.setMode(data.mode === "demo" ? "live" : "demo")
            }
          >
            {data.mode === "demo" ? "LIVE" : "DEMO"}
          </button>
        )}
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

      <div className="scanlines" />
      <div className="vignette" />
    </div>
  );
}
