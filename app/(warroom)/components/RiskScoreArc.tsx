"use client";

import { useTickedNumber } from "../hooks/useTickedNumber";

function arcColor(score: number): "green" | "amber" | "orange" | "red" {
  if (score >= 0.8) return "red";
  if (score >= 0.6) return "orange";
  if (score >= 0.3) return "amber";
  return "green";
}

const COLOR_MAP: Record<string, string> = {
  green: "var(--green, #22c55e)",
  amber: "var(--amber, #ff8800)",
  orange: "var(--orange, #f97316)",
  red: "var(--red, #ff3344)",
};

export function RiskScoreArc({ score }: { score: number }) {
  const animated = useTickedNumber(score, 600);
  const color = arcColor(animated);
  const r = 28;
  const circumference = 2 * Math.PI * r;
  const dash = circumference * animated;

  return (
    <span
      className="risk-arc"
      data-color={color}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        position: "relative",
      }}
    >
      <svg
        className="risk-arc"
        width={66}
        height={66}
        viewBox="0 0 66 66"
        style={{ transform: "rotate(-90deg)" }}
      >
        <circle
          cx={33}
          cy={33}
          r={r}
          fill="none"
          stroke="var(--line, #1f1f1f)"
          strokeWidth={4}
        />
        <circle
          cx={33}
          cy={33}
          r={r}
          fill="none"
          stroke={COLOR_MAP[color]}
          strokeWidth={4}
          strokeDasharray={`${dash} ${circumference}`}
          strokeLinecap="round"
          style={{ transition: "stroke 200ms" }}
        />
      </svg>
      <span
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "var(--mono)",
          fontSize: 14,
          fontWeight: 700,
          color: COLOR_MAP[color],
        }}
      >
        {animated.toFixed(2)}
      </span>
    </span>
  );
}
