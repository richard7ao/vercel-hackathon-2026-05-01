"use client";

import { useState, useEffect } from "react";

type SuspendedProps = {
  verdict: { level: string; acknowledged?: boolean } | null;
  suspendedSinceMs?: number;
};

const SHOW_LEVELS = new Set(["critical", "investigate"]);

export function SuspendedOverlay({ verdict, suspendedSinceMs }: SuspendedProps) {
  const [elapsed, setElapsed] = useState(0);

  const visible =
    verdict !== null &&
    SHOW_LEVELS.has(verdict.level) &&
    verdict.acknowledged === false;

  useEffect(() => {
    if (!visible) return;
    const start = suspendedSinceMs ?? Date.now();
    const tick = setInterval(() => {
      setElapsed(Math.floor((Date.now() - start) / 1000));
    }, 1000);
    return () => clearInterval(tick);
  }, [visible, suspendedSinceMs]);

  if (!visible) return null;

  const m = Math.floor(elapsed / 60);
  const s = elapsed % 60;
  const ts = `${m}:${s.toString().padStart(2, "0")}`;

  return (
    <div
      className="suspended-overlay visible"
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        height: 28,
        background: "rgba(255,136,0,0.12)",
        borderTop: "1px solid var(--amber)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        fontFamily: "var(--mono)",
        fontSize: 11,
        color: "var(--amber)",
        letterSpacing: 1,
        zIndex: 100,
        animation: "suspended-pulse 1.5s ease-in-out infinite",
      }}
    >
      [ WORKFLOW · SUSPENDED · awaiting human · t+{ts} ]
    </div>
  );
}
