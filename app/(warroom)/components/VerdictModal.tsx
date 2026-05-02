"use client";

import type { Verdict } from "../data";

export function VerdictModal({
  verdict,
  onClose,
}: {
  verdict: Verdict | null;
  onClose: () => void;
}) {
  if (!verdict) return null;
  return (
    <div className="verdict">
      <div className="verdict-head">
        <span>
          SYNTHESIZER VERDICT // dep_{verdict.deploy_id_short}
        </span>
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

        <div className="verdict-actions-row">
          <button className="btn" onClick={onClose}>
            ACKNOWLEDGE
          </button>
          <button className="btn primary" onClick={onClose}>
            HOLD ROLLBACK
          </button>
          <button className="btn danger" onClick={onClose}>
            PAGE @oncall
          </button>
        </div>
      </div>
    </div>
  );
}
