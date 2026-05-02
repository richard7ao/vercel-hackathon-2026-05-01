"use client";

import { useDemo } from "./hooks/useDemo";
import { TopBar } from "./components/TopBar";
import { StatusBlock } from "./components/StatusBlock";
import { TimelineRow } from "./components/TimelineRow";
import { AgentsPanel } from "./components/AgentsPanel";
import { FeedPanel } from "./components/FeedPanel";
import { HeatmapPanel } from "./components/HeatmapPanel";
import { ThreatPanel } from "./components/ThreatPanel";
import { VerdictModal } from "./components/VerdictModal";

export default function WarRoom() {
  const demo = useDemo();

  return (
    <div className="shell">
      <TopBar activeDeploy={demo.activeDeploy} />

      <StatusBlock
        state={demo.state}
        uptime={demo.uptime}
        deploysAnalyzed={demo.deploysAnalyzed}
        agentsStanding={demo.agentsStanding}
        mtta={demo.mtta}
      />

      <TimelineRow
        deploys={demo.deploys}
        activeId={demo.activeDeploy?.id ?? null}
        onSelect={demo.setActiveDeploy}
      />

      <div className="main-grid">
        <AgentsPanel agents={demo.agents} />
        <FeedPanel feed={demo.feed} />
        <HeatmapPanel grid={demo.heatmap} peakCell={demo.peakCell} />
        <ThreatPanel threats={demo.threats} />
      </div>

      <VerdictModal
        verdict={demo.verdict}
        onClose={() => demo.setVerdict(null)}
      />

      <div className="demo-ctrl">
        {!demo.running && (
          <button className="btn primary" onClick={demo.runDemo}>
            ▶ RUN DEMO
          </button>
        )}
        <button className="btn" onClick={demo.reset}>
          ↺ RESET
        </button>
      </div>

      <div className="scanlines" />
      <div className="vignette" />
    </div>
  );
}
