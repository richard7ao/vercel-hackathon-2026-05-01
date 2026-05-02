"use client";

import { useEffect, useState } from "react";

export function ResumePulse({ acknowledged }: { acknowledged: boolean }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (acknowledged) {
      setShow(true);
      const t = setTimeout(() => setShow(false), 600);
      return () => clearTimeout(t);
    }
  }, [acknowledged]);

  if (!show) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        pointerEvents: "none",
        border: "4px solid var(--green)",
        zIndex: 200,
        animation: "resume-flash 600ms ease-out forwards",
      }}
    />
  );
}
