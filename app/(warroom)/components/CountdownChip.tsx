"use client";

type Props = {
  nextPlayInMs: number;
};

export function CountdownChip({ nextPlayInMs }: Props) {
  const secs = Math.ceil(nextPlayInMs / 1000);
  if (secs <= 0) return null;
  const mm = Math.floor(secs / 60);
  const ss = secs % 60;
  return (
    <div className="countdown-chip">
      NEXT PLAY &middot; {mm}:{ss.toString().padStart(2, "0")}
    </div>
  );
}
