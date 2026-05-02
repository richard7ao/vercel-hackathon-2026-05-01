"use client";

import { useMemo } from "react";
import type { RehearsalRow } from "../rehearsal/runLiveRehearsals";

const ACTION_LABELS: Record<string, string> = {
  ack: "ACK",
  hold: "HOLD",
  page: "PAGE",
};

type RehearsalDockProps = {
  rows: RehearsalRow[];
  running: boolean;
  onAbort: () => void;
  onDismiss: () => void;
  onRerun: () => void;
};

export function RehearsalDock({
  rows,
  running,
  onAbort,
  onDismiss,
  onRerun,
}: RehearsalDockProps) {
  const lastLine = useMemo(() => {
    for (let i = rows.length - 1; i >= 0; i--) {
      const t = rows[i].trace;
      if (t.length > 0) return t[t.length - 1].label;
    }
    return "—";
  }, [rows]);

  const allDone =
    rows.length === 3 && rows.every((r) => r.status === "done" || r.status === "error");
  const passCount = rows.filter((r) => r.status === "done").length;

  return (
    <div className="rehearsal-dock" aria-live="polite">
      <div className="rehearsal-dock-head">
        <span className="rehearsal-dock-title">BOARD REHEARSAL</span>
        <span className="rehearsal-dock-sub">
          Real canary git push → webhook → hook → resume → revert (repeatable). Same 3 actions as trace modal.
        </span>
      </div>
      <div className="rehearsal-dock-chips">
        {rows.map((r) => {
          const chip =
            r.status === "done" ? "ok" : r.status === "error" ? "err" : "run";
          return (
          <span
            key={r.sha}
            className={`rehearsal-dock-chip rehearsal-dock-chip-${chip}`}
          >
            {ACTION_LABELS[r.action] ?? r.action}{" "}
            {r.status === "done" ? "✓" : r.status === "error" ? "✗" : "…"}
          </span>
        );
        })}
      </div>
      <div className="rehearsal-dock-phase tab-num">{lastLine}</div>
      <div className="rehearsal-dock-foot">
        {running && (
          <button type="button" className="btn danger" onClick={onAbort}>
            ■ ABORT
          </button>
        )}
        {!running && rows.length > 0 && !allDone && (
          <button type="button" className="btn primary" onClick={onRerun}>
            ↺ RE-RUN
          </button>
        )}
        {allDone && (
          <span className="rehearsal-dock-summary tab-num">
            {passCount}/{rows.length} PASSED
          </span>
        )}
        <button type="button" className="btn" onClick={onDismiss}>
          DISMISS
        </button>
      </div>
    </div>
  );
}
