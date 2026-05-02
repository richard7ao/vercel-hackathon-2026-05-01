"use client";

type ModeToggleProps = {
  mode: "demo" | "live";
  sseStatus?: "idle" | "connected" | "reconnecting";
  onToggle?: () => void;
};

export function ModeToggle({
  mode,
  sseStatus = "idle",
  onToggle,
}: ModeToggleProps) {
  const isDemo = mode === "demo";
  const isConnected = sseStatus === "connected";
  const isReconnecting = sseStatus === "reconnecting";

  const color = isDemo
    ? "amber"
    : isConnected
      ? "green"
      : "amber";

  const label = isDemo
    ? "DEMO · auto-loop"
    : isReconnecting
      ? "LIVE · reconnecting"
      : "LIVE · connected";

  const tooltip = isDemo
    ? "Watching a 25-second simulation. Click to switch to live monitoring."
    : "Real-time feed from production deploys. Click to switch back to simulation.";

  return (
    <button
      className="mode-toggle"
      onClick={onToggle}
      title={tooltip}
      data-color={color}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        background: "transparent",
        border: `1px solid var(--${color})`,
        color: `var(--${color})`,
        padding: "3px 10px",
        fontFamily: "var(--mono)",
        fontSize: 10,
        letterSpacing: 1,
        cursor: "pointer",
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: `var(--${color})`,
          boxShadow: `0 0 6px var(--${color})`,
          animation: "pulse-dot 1.4s ease-in-out infinite",
        }}
      />
      [ {label} ]
    </button>
  );
}
