"use client";

import { DeployTimeline } from "./DeployTimeline";
import type { Deploy } from "../data";

export function TimelineRow({
  deploys,
  activeId,
  onSelect,
}: {
  deploys: Deploy[];
  activeId: string | null;
  onSelect?: (d: Deploy) => void;
}) {
  const total = deploys.length;
  const last = deploys[deploys.length - 1];
  const lastTs = last ? new Date(last.pushed_at) : new Date();
  return (
    <div className="timeline">
      <div className="timeline-side">
        <div>
          DEPLOY TIMELINE <span className="dim">// LAST 30D</span>
        </div>
        <div>
          <span className="muted">N=</span>
          <span className="v tab-num">{total}</span>{" "}
          <span className="muted">&middot;</span>{" "}
          <span className="v">P50 0.11</span>
        </div>
      </div>
      <DeployTimeline
        deploys={deploys}
        activeId={activeId}
        onSelect={onSelect}
      />
      <div className="timeline-side right">
        <div className="now-marker">
          <span className="tri" />
          NOW
        </div>
        <div className="muted tab-num">
          {lastTs.toISOString().slice(11, 16)}Z
        </div>
        <div className="muted">+0.4d HORIZON</div>
      </div>
    </div>
  );
}
