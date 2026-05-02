"use client";

import { useState } from "react";
import type { Verdict } from "../data";

type ResumeAction = "ack" | "hold" | "page";

export function VerdictModal({
  verdict,
  onClose,
  onPage,
  onResumeAction,
  onDismissModal,
}: {
  verdict: Verdict | null;
  onClose: () => void;
  onPage?: () => void;
  /** Live mode: call WDK resumeHook via `/api/demo/resume` for each human action. */
  onResumeAction?: (action: ResumeAction) => Promise<void>;
  /** Live mode: hide modal without sending resume (e.g. read-only dismiss). */
  onDismissModal?: () => void;
}) {
  const [busy, setBusy] = useState<ResumeAction | null>(null);
  const [err, setErr] = useState<string | null>(null);

  if (!verdict) return null;

  const acked = verdict.acknowledged === true;
  const liveActions = typeof onResumeAction === "function";
  const depLabel = verdict.deploy_id_short ?? verdict.deploy_id?.slice(-8) ?? "—";

  const runLive = async (action: ResumeAction) => {
    if (!onResumeAction) return;
    setErr(null);
    setBusy(action);
    try {
      await onResumeAction(action);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="verdict">
      <div className="verdict-head">
        <span className="verdict-head-title" title={`SYNTHESIZER VERDICT // dep_${depLabel}`}>
          {`SYNTHESIZER VERDICT // dep_${depLabel}`}
        </span>
        {acked ? (
          <span className="verdict-badge verdict-badge-acked">
            [ ACKNOWLEDGED &middot; {verdict.acknowledged_by} ]
          </span>
        ) : (
          <span className="verdict-badge verdict-badge-awaiting">
            [ AWAITING ACK &middot; paused ]
          </span>
        )}
        <button
          type="button"
          className="x"
          onClick={() => (onDismissModal ? onDismissModal() : onClose())}
        >
          [ X ]
        </button>
      </div>
      <div className="verdict-body">
        <div className="verdict-level">[ {verdict.level.toUpperCase()} ]</div>
        <div className="verdict-summary">{verdict.summary}</div>

        <div className="verdict-section-label">
          CONCERNS &middot; {verdict.concerns.length}
        </div>
        <ul className="verdict-concerns">
          {verdict.concerns.map((c, i) => (
            <li key={i}>{c}</li>
          ))}
        </ul>

        <div className="verdict-section-label">SUGGESTED ACTION</div>
        <div className="verdict-action">
          <span className="lbl">recommended</span>
          {verdict.suggested_action}
        </div>

        {err && (
          <div className="verdict-error" style={{ color: "var(--red)", marginTop: 10, fontSize: 10 }}>
            {err}
          </div>
        )}

        {!acked && (
          <div className="verdict-actions-row">
            {liveActions ? (
              <>
                <button
                  type="button"
                  className="btn"
                  disabled={busy !== null}
                  onClick={() => void runLive("ack")}
                >
                  {busy === "ack" ? "…" : "ACKNOWLEDGE"}
                </button>
                <button
                  type="button"
                  className="btn primary"
                  disabled={busy !== null}
                  onClick={() => void runLive("hold")}
                >
                  {busy === "hold" ? "…" : "HOLD ROLLBACK"}
                </button>
                <button
                  type="button"
                  className="btn danger"
                  disabled={busy !== null}
                  onClick={() => void runLive("page")}
                >
                  {busy === "page" ? "…" : "PAGE @oncall"}
                </button>
              </>
            ) : (
              <>
                <button type="button" className="btn" onClick={onClose}>
                  ACKNOWLEDGE
                </button>
                <button type="button" className="btn primary" onClick={onClose}>
                  HOLD ROLLBACK
                </button>
                <button type="button" className="btn danger" onClick={onPage ?? onClose}>
                  PAGE @oncall
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
