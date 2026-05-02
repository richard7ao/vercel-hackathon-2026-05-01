"use client";

import type { Deploy } from "../data";
import { aggregateAreas, type Area } from "../../../lib/file-classifier";

const AREA_LABELS: Record<Area, string> = {
  api: "API",
  web: "WEB",
  workers: "WORKERS",
  data: "DATA",
  infra: "INFRA",
  third: "THIRD",
};

const AREA_ORDER: Area[] = ["api", "web", "workers", "data", "infra", "third"];

function scoreColor(score: number): string {
  if (score >= 0.7) return "var(--red, #ff3333)";
  if (score >= 0.4) return "var(--amber, #ff8800)";
  if (score >= 0.1) return "rgba(255,136,0,0.5)";
  return "rgba(255,136,0,0.15)";
}

export function SystemHeatmap({ deploys }: { deploys: Deploy[] }) {
  const areas = aggregateAreas(deploys);
  const totalFiles = Math.max(
    1,
    AREA_ORDER.reduce((s, a) => s + areas[a].file_count, 0)
  );

  return (
    <div className="panel">
      <div className="panel-header">
        <div className="title">
          <span className="pre">[06]</span> SYSTEM-AREA HEATMAP{" "}
          <span className="pre">// ARCHITECTURAL VIEW</span>
        </div>
      </div>
      <div className="panel-body">
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gridTemplateRows: "repeat(2, 1fr)",
            gap: 2,
            height: "100%",
            minHeight: 120,
          }}
        >
          {AREA_ORDER.map((area) => {
            const agg = areas[area];
            const share = agg.file_count / totalFiles;
            const glow = agg.score > 0.7;
            return (
              <div
                key={area}
                style={{
                  background: scoreColor(agg.score),
                  border: glow
                    ? "1px solid var(--red, #ff3333)"
                    : "1px solid rgba(255,255,255,0.05)",
                  boxShadow: glow
                    ? "0 0 8px rgba(255,51,51,0.4)"
                    : "none",
                  padding: "6px 8px",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  fontFamily: "var(--mono)",
                  fontSize: 10,
                  position: "relative",
                  overflow: "hidden",
                }}
                title={`${AREA_LABELS[area]} · score ${agg.score.toFixed(2)} · ${agg.file_count} files`}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <span
                    style={{
                      fontWeight: 700,
                      color: "var(--fg, #e0e0e0)",
                      letterSpacing: 1,
                    }}
                  >
                    {AREA_LABELS[area]}
                  </span>
                  <span style={{ color: "var(--fg-mute, #888)", fontSize: 9 }}>
                    {(share * 100).toFixed(0)}%
                  </span>
                </div>
                <div style={{ color: "var(--fg-mute, #888)", fontSize: 9 }}>
                  {agg.top_subareas.length > 0
                    ? agg.top_subareas.join(" · ")
                    : "—"}
                </div>
                <div
                  style={{
                    color: scoreColor(agg.score),
                    fontWeight: 700,
                    fontSize: 11,
                  }}
                >
                  {agg.score.toFixed(2)}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
