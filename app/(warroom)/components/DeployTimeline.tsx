"use client";

import { useState, useEffect, useRef } from "react";
import { DAY } from "../data";
import type { Deploy } from "../data";

export function DeployTimeline({
  deploys,
  activeId,
  onSelect,
}: {
  deploys: Deploy[];
  activeId: string | null;
  onSelect?: (d: Deploy) => void;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<{
    d: Deploy;
    cx: number;
    cy: number;
  } | null>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    if (!wrap.current) return;
    const ro = new ResizeObserver(() => {
      if (wrap.current) setW(wrap.current.clientWidth);
    });
    ro.observe(wrap.current);
    setW(wrap.current.clientWidth);
    return () => ro.disconnect();
  }, []);

  const HEIGHT = 64;
  if (!deploys.length || !w)
    return <div className="timeline-canvas" ref={wrap} />;

  const NOW = Date.now();
  const tMin = NOW - 30 * DAY;
  const tMax = NOW + 0.4 * DAY;
  const x = (t: number) => 8 + ((t - tMin) / (tMax - tMin)) * (w - 16);

  const colorFor = (s: number) => {
    if (s >= 0.8) return "var(--red)";
    if (s >= 0.6) return "var(--orange)";
    if (s >= 0.3) return "var(--amber)";
    return "var(--green)";
  };

  // day gridlines
  const gridLines: React.ReactNode[] = [];
  for (let i = 0; i <= 30; i += 5) {
    const t = tMin + i * DAY;
    gridLines.push(
      <line
        key={i}
        x1={x(t)}
        x2={x(t)}
        y1={10}
        y2={HEIGHT - 16}
        stroke="var(--line)"
        strokeWidth="1"
        strokeDasharray="2 3"
      />
    );
  }

  return (
    <div
      className="timeline-canvas"
      ref={wrap}
      onMouseLeave={() => setTip(null)}
    >
      <svg viewBox={`0 0 ${w} ${HEIGHT}`} preserveAspectRatio="none">
        {/* axis */}
        <line
          x1="0"
          x2={w}
          y1={HEIGHT - 14}
          y2={HEIGHT - 14}
          stroke="var(--line-1)"
          strokeWidth="1"
        />
        {gridLines}
        {/* date ticks */}
        {[30, 22, 14, 7, 1].map((d, i) => {
          const t = NOW - d * DAY;
          const dt = new Date(t);
          const m = dt
            .toLocaleString("en-US", { month: "short", timeZone: "UTC" })
            .toUpperCase();
          return (
            <g key={i}>
              <line
                x1={x(t)}
                x2={x(t)}
                y1={HEIGHT - 16}
                y2={HEIGHT - 12}
                stroke="var(--fg-faint)"
              />
              <text
                x={x(t)}
                y={HEIGHT - 3}
                fontSize="9"
                fill="var(--fg-mute)"
                textAnchor="middle"
                fontFamily="JetBrains Mono"
                letterSpacing="0.08em"
              >
                {m} {dt.getUTCDate().toString().padStart(2, "0")}
              </text>
            </g>
          );
        })}
        {/* deploys */}
        {deploys.map((d) => {
          const cx = x(+new Date(d.pushed_at));
          const cy = 22 - d.score * 8;
          const r = d.score >= 0.6 ? 3.5 : 2.2;
          const isActive = d.id === activeId;
          return (
            <g
              key={d.id}
              onMouseEnter={() => setTip({ d, cx, cy })}
              onClick={() => onSelect && onSelect(d)}
              style={{ cursor: "pointer" }}
            >
              <circle
                cx={cx}
                cy={cy}
                r={r}
                fill={colorFor(d.score)}
                stroke={isActive ? "var(--fg)" : "none"}
                strokeWidth={isActive ? 1.2 : 0}
                style={
                  d.score >= 0.8
                    ? { filter: "drop-shadow(0 0 4px var(--red))" }
                    : undefined
                }
              />
              {/* faint vertical drop */}
              <line
                x1={cx}
                x2={cx}
                y1={cy + r}
                y2={HEIGHT - 16}
                stroke={colorFor(d.score)}
                strokeOpacity={d.score >= 0.6 ? 0.4 : 0.12}
              />
            </g>
          );
        })}
        {/* NOW marker */}
        <line
          x1={x(NOW)}
          x2={x(NOW)}
          y1={6}
          y2={HEIGHT - 14}
          stroke="var(--amber)"
          strokeWidth="1"
          strokeDasharray="3 2"
        />
      </svg>
      {tip && (
        <div className="timeline-tooltip" style={{ left: tip.cx, top: tip.cy }}>
          <div className="row">
            <span className="k">SHA</span>
            <span className="v">{tip.d.sha}</span>
          </div>
          <div className="row">
            <span className="k">AUTHOR</span>
            <span className="v">{tip.d.author}</span>
          </div>
          <div className="row">
            <span className="k">SCORE</span>
            <span
              className="v"
              style={{
                color:
                  tip.d.score >= 0.6
                    ? "var(--red)"
                    : tip.d.score >= 0.3
                      ? "var(--amber)"
                      : "var(--green)",
              }}
            >
              {tip.d.score.toFixed(2)}
            </span>
          </div>
          <div className="row" style={{ marginTop: 4 }}>
            <span className="v" style={{ color: "var(--fg-dim)" }}>
              {tip.d.tldr}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
