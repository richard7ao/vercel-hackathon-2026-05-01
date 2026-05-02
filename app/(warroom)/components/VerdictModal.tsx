"use client";

import type { Verdict } from "../data";

export function VerdictModal({
  verdict,
  onClose,
  onPage,
}: {
  verdict: Verdict | null;
  onClose: () => void;
  onPage?: () => void;
}) {
  if (!verdict) return null;

  const acked = verdict.acknowledged === true;

  return (
    <div className="verdict">
      <div className="verdict-head">
        <span>
          SYNTHESIZER VERDICT // dep_{verdict.deploy_id_short}
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
        <button className="x" onClick={onClose}>
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

        {!acked && (
          <div className="verdict-actions-row">
            <button className="btn" onClick={onClose}>
              ACKNOWLEDGE
            </button>
            <button className="btn primary" onClick={onClose}>
              HOLD ROLLBACK
            </button>
            <button className="btn danger" onClick={onPage ?? onClose}>
              PAGE @oncall
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
