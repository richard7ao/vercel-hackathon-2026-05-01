"use client";

const NODES = [
  { label: "webhook", x: 20, y: 10 },
  { label: "ingest", x: 120, y: 10 },
  { label: "signals", x: 220, y: 10 },
  { label: "score", x: 220, y: 50 },
  { label: "dispatch", x: 220, y: 90 },
  { label: "history", x: 80, y: 130 },
  { label: "runtime/trace", x: 200, y: 130 },
  { label: "dependency · diff", x: 320, y: 130 },
  { label: "synthesizer", x: 220, y: 170 },
  { label: "Discord page", x: 220, y: 210 },
  { label: "human ack/hold/page", x: 220, y: 250 },
  { label: "resume", x: 220, y: 290 },
];

export function ArchDiagram() {
  return (
    <svg
      viewBox="0 0 460 320"
      style={{
        width: "100%",
        maxWidth: 460,
        fontFamily: "var(--mono)",
        fontSize: 9,
      }}
    >
      {NODES.map((n) => (
        <g key={n.label}>
          <rect
            x={n.x}
            y={n.y}
            width={n.label.length * 7 + 12}
            height={22}
            rx={2}
            fill="var(--bg-2, #0f0f0f)"
            stroke="var(--amber, #ff8800)"
            strokeWidth={0.5}
          />
          <text
            x={n.x + 6}
            y={n.y + 14}
            fill="var(--fg-dim, #9a9a9a)"
          >
            {n.label}
          </text>
        </g>
      ))}
      <line x1={75} y1={21} x2={120} y2={21} stroke="var(--line-1)" />
      <line x1={175} y1={21} x2={220} y2={21} stroke="var(--line-1)" />
      <line x1={250} y1={32} x2={250} y2={50} stroke="var(--line-1)" />
      <line x1={250} y1={72} x2={250} y2={90} stroke="var(--line-1)" />
      <line x1={220} y1={101} x2={130} y2={130} stroke="var(--line-1)" />
      <line x1={250} y1={112} x2={250} y2={130} stroke="var(--line-1)" />
      <line x1={280} y1={101} x2={370} y2={130} stroke="var(--line-1)" />
      <line x1={250} y1={152} x2={250} y2={170} stroke="var(--line-1)" />
      <line x1={250} y1={192} x2={250} y2={210} stroke="var(--line-1)" />
      <line x1={250} y1={232} x2={250} y2={250} stroke="var(--line-1)" />
      <line x1={250} y1={272} x2={250} y2={290} stroke="var(--line-1)" />
    </svg>
  );
}
