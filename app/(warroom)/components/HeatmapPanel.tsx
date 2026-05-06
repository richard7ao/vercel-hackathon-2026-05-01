"use client";

import { HEATMAP_FILES } from "../data";

export function HeatmapPanel({
  grid,
  peakCell,
}: {
  grid: number[][];
  peakCell: { r: number; c: number } | null;
}) {
  const cols = grid[0]?.length || 0;
  return (
    <div className="panel">
      <div className="panel-header">
        <div className="title">
          <span className="pre">[06]</span> ANOMALY HEATMAP{" "}
          <span className="pre">// FILES &times; HOURS &middot; 7D</span>
        </div>
        <div className="right">
          <span className="muted">&sigma;</span>{" "}
          <span style={{ color: "var(--fg)" }}>0.18</span>
          <span className="muted">&middot;</span>
          <span className="muted">PEAK</span>{" "}
          <span style={{ color: "var(--amber)" }}>0.81</span>
        </div>
      </div>
      <div className="panel-body">
        <div className="heatmap-wrap">
          <div className="heatmap-files">
            {HEATMAP_FILES.map((f, i) => (
              <div key={i} className="file" title={f}>
                <span style={{ color: "var(--fg-mute)", marginRight: 6 }}>
                  {(i + 1).toString().padStart(2, "0")}
                </span>
                {f}
              </div>
            ))}
          </div>
          <div className="heatmap-grid-wrap">
            <div
              className="heatmap-grid"
              style={{
                gridTemplateColumns: `repeat(${cols}, 1fr)`,
                gridTemplateRows: `repeat(${grid.length}, 1fr)`,
              }}
            >
              {grid.map((row, r) =>
                row.map((v, c) => {
                  const isPeakRed =
                    peakCell && peakCell.r === r && peakCell.c === c;
                  const isHigh = v > 0.55;
                  const alpha = Math.min(1, v * 1.2);
                  const bg = isHigh
                    ? `rgba(255,136,0,${alpha})`
                    : `rgba(255,136,0,${alpha * 0.6})`;
                  return (
                    <div
                      key={r + "-" + c}
                      className={
                        "heatmap-cell" +
                        (isHigh ? " peak" : "") +
                        (isPeakRed ? " peak-red" : "")
                      }
                      style={{ background: bg }}
                      title={`${HEATMAP_FILES[r]} · σ ${v.toFixed(2)}`}
                    />
                  );
                })
              )}
            </div>
            <div className="heatmap-axis">
              <span>&minus;7D</span>
              <span>&minus;5D</span>
              <span>&minus;3D</span>
              <span>&minus;24H</span>
              <span>NOW</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
