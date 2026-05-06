"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { runLiveRehearsals, type RehearsalRow } from "../rehearsal/runLiveRehearsals";

const ACTION_LABELS: Record<string, { label: string; cls: string }> = {
  ack: { label: "ACKNOWLEDGE", cls: "" },
  hold: { label: "HOLD ROLLBACK", cls: "primary" },
  page: { label: "PAGE @ONCALL", cls: "danger" },
};

export function RehearsalModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [rehearsals, setRehearsals] = useState<RehearsalRow[]>([]);
  const [running, setRunning] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [rehearsals]);

  const runAll = useCallback(async () => {
    setRehearsals([]);
    setRunning(true);
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      await runLiveRehearsals(ctrl.signal, setRehearsals);
    } finally {
      setRunning(false);
    }
  }, []);

  const handleClose = useCallback(() => {
    abortRef.current?.abort();
    setRunning(false);
    onClose();
  }, [onClose]);

  if (!open) return null;

  const allDone =
    rehearsals.length === 3 &&
    rehearsals.every((r) => r.status === "done" || r.status === "error");
  const passCount = rehearsals.filter((r) => r.status === "done").length;

  return (
    <div className="rehearsal-overlay" onClick={handleClose}>
      <div className="rehearsal-modal" onClick={(e) => e.stopPropagation()}>
        <div className="rehearsal-head">
          <span>VISUAL TRACE REHEARSAL</span>
          <button className="x" type="button" onClick={handleClose}>
            [ X ]
          </button>
        </div>

        <div className="rehearsal-body" ref={logRef}>
          {rehearsals.length === 0 && (
            <div className="rehearsal-empty">
              <p>
                Each run <b>pushes a real canary commit</b> to the monitored repo (non-allowlisted{" "}
                <code>fetch</code>), waits for the GitHub webhook → watchdog → agents → WDK hook, then{" "}
                <b>reverts</b> the file so you can repeat. Needs <code>GITHUB_TOKEN</code> with{" "}
                <code>contents:write</code> on that repo.
              </p>
              <div className="rehearsal-actions-preview">
                {(["ack", "hold", "page"] as const).map((a) => (
                  <span key={a} className={`rehearsal-action-chip ${ACTION_LABELS[a].cls}`}>
                    {ACTION_LABELS[a].label}
                  </span>
                ))}
              </div>
              <p className="rehearsal-sub">
                For the same runs with the timeline, agents, and feed visible, use{" "}
                <b>BOARD REHEARSAL</b> on the dashboard (no modal).
              </p>
            </div>
          )}

          {rehearsals.map((r, i) => (
            <div key={r.sha} className="rehearsal-run">
              <div className="rehearsal-run-head">
                <span className={`rehearsal-action-chip ${ACTION_LABELS[r.action].cls}`}>
                  {ACTION_LABELS[r.action].label}
                </span>
                <span className="rehearsal-sha">{r.sha}</span>
                <span className={`rehearsal-status rehearsal-status-${r.status}`}>
                  {r.status === "done"
                    ? "PASS"
                    : r.status === "error"
                      ? "FAIL"
                      : r.status.replace("_", " ").toUpperCase()}
                </span>
              </div>
              <div className="rehearsal-trace">
                {r.trace.map((t, j) => (
                  <div key={j} className={`trace-line trace-${t.status}`}>
                    <span className="trace-ts">{t.ts}</span>
                    <span className={`trace-dot trace-dot-${t.status}`} />
                    <span className="trace-label">{t.label}</span>
                    {t.detail && <span className="trace-detail">{t.detail}</span>}
                  </div>
                ))}
              </div>
              {r.error && <div className="rehearsal-error">{r.error}</div>}
            </div>
          ))}

          {allDone && (
            <div className="rehearsal-summary">
              {passCount}/{rehearsals.length} PASSED
            </div>
          )}
        </div>

        <div className="rehearsal-foot">
          {!running && !allDone && (
            <button type="button" className="btn primary" onClick={runAll}>
              ▶ RUN ALL 3 REHEARSALS
            </button>
          )}
          {running && (
            <button type="button" className="btn danger" onClick={() => abortRef.current?.abort()}>
              ■ ABORT
            </button>
          )}
          {allDone && (
            <button type="button" className="btn primary" onClick={runAll}>
              ↺ RE-RUN
            </button>
          )}
          <button type="button" className="btn" onClick={handleClose}>
            CLOSE
          </button>
        </div>
      </div>
    </div>
  );
}
