"use client";

export function LegendCard({
  mode,
  elapsedMs,
  dismissed,
  onDismiss,
}: {
  mode: "demo" | "live";
  elapsedMs: number;
  dismissed: boolean;
  onDismiss?: () => void;
}) {
  if (mode !== "demo") return null;
  if (dismissed) return null;
  if (elapsedMs > 8000) return null;

  return (
    <div
      className="legend-card"
      style={{
        position: "fixed",
        bottom: 24,
        left: 24,
        width: 280,
        background: "var(--bg-2)",
        border: "1px solid var(--line-1)",
        padding: "12px 14px",
        fontFamily: "var(--mono)",
        fontSize: 10,
        lineHeight: 1.5,
        color: "var(--fg-dim)",
        zIndex: 40,
        animation: "verdict-in 280ms ease-out",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: 6,
        }}
      >
        <span style={{ color: "var(--amber)", fontWeight: 700 }}>
          What you&apos;re watching
        </span>
        <button
          onClick={onDismiss}
          style={{
            background: "none",
            border: "none",
            color: "var(--fg-mute)",
            cursor: "pointer",
            fontFamily: "var(--mono)",
            fontSize: 10,
          }}
        >
          [ x ]
        </button>
      </div>
      A 25-second simulation of how Bridge investigates a risky deploy. Pushed
      code is scored across structural, behavioral, and temporal signals;
      high-risk pushes dispatch 5 specialist agents in parallel; a synthesizer
      collapses findings into a verdict; a human pauses or acknowledges via
      Discord. Every workflow is durable.
    </div>
  );
}
