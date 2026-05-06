"use client";

import { useState, useCallback, useRef, useEffect } from "react";
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
import { RehearsalModal } from "./components/RehearsalModal";
import { RehearsalDock } from "./components/RehearsalDock";
import { LiveControlCentre } from "./components/LiveControlCentre";
import { runLiveRehearsals, type RehearsalRow } from "./rehearsal/runLiveRehearsals";

export default function WarRoom() {
  const data = useDeploysSSE();
  const [traceRehearsalOpen, setTraceRehearsalOpen] = useState(false);
  const [boardDockOpen, setBoardDockOpen] = useState(false);
  const [boardRows, setBoardRows] = useState<RehearsalRow[]>([]);
  const [boardRunning, setBoardRunning] = useState(false);
  const boardAbortRef = useRef<AbortController | null>(null);

  const startBoardRehearsal = useCallback(async () => {
    if (boardRunning) return;
    setTraceRehearsalOpen(false);
    setBoardDockOpen(true);
    setBoardRows([]);
    setBoardRunning(true);
    const ctrl = new AbortController();
    boardAbortRef.current = ctrl;
    try {
      await runLiveRehearsals(ctrl.signal, setBoardRows);
    } finally {
      setBoardRunning(false);
      boardAbortRef.current = null;
    }
  }, [boardRunning]);

  const abortBoardRehearsal = useCallback(() => {
    boardAbortRef.current?.abort();
    setBoardRunning(false);
  }, []);

  const dismissBoardDock = useCallback(() => {
    boardAbortRef.current?.abort();
    setBoardRunning(false);
    setBoardDockOpen(false);
    setBoardRows([]);
  }, []);

  const [liveVerdictDismissed, setLiveVerdictDismissed] = useState(false);
  const lastLiveVerdictDeployRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (data.mode !== "live") {
      setLiveVerdictDismissed(false);
      lastLiveVerdictDeployRef.current = undefined;
      return;
    }
    const id = data.verdict?.deploy_id;
    if (id && id !== lastLiveVerdictDeployRef.current) {
      lastLiveVerdictDeployRef.current = id;
      setLiveVerdictDismissed(false);
    }
    if (!id) {
      lastLiveVerdictDeployRef.current = undefined;
    }
  }, [data.mode, data.verdict?.deploy_id]);

  const verdictForModal =
    data.verdict && (data.mode !== "live" || !liveVerdictDismissed) ? data.verdict : null;

  return (
    <div
      className={
        data.mode === "live" && boardDockOpen
          ? "shell shell--board-rehearsal"
          : "shell"
      }
    >
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
        verdict={verdictForModal}
        onClose={() => {
          if (data.mode !== "live" && data.verdict && !data.verdict.acknowledged) {
            data.setVerdict({ ...data.verdict, acknowledged: true, acknowledged_by: "you" });
          } else if (data.mode !== "live") {
            data.setVerdict(null);
          }
        }}
        onResumeAction={data.resumeVerdictAction}
        onDismissModal={
          data.mode === "live" ? () => setLiveVerdictDismissed(true) : undefined
        }
      />

      <div className="demo-ctrl">
        {data.mode === "demo" && (
          <>
            {!data.running && (
              <button className="btn primary" onClick={data.runDemo}>
                ▶ RUN DEMO
              </button>
            )}
            <button className="btn" onClick={data.reset}>
              ↺ RESET
            </button>
          </>
        )}
      </div>

      {data.mode === "live" && (
        <LiveControlCentre
          boardRunning={boardRunning}
          traceRehearsalOpen={traceRehearsalOpen}
          onOpenTrace={() => {
            setBoardDockOpen(false);
            setTraceRehearsalOpen(true);
          }}
          onStartBoardRehearsal={() => void startBoardRehearsal()}
        />
      )}

      <RehearsalModal open={traceRehearsalOpen} onClose={() => setTraceRehearsalOpen(false)} />

      {data.mode === "live" && boardDockOpen && (
        <RehearsalDock
          rows={boardRows}
          running={boardRunning}
          onAbort={abortBoardRehearsal}
          onDismiss={dismissBoardDock}
          onRerun={() => void startBoardRehearsal()}
        />
      )}

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
