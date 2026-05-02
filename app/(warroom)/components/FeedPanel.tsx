"use client";

import { useEffect, useRef } from "react";
import type { FeedEntry } from "../data";
import { FeedLine } from "./FeedLine";

export function FeedPanel({ feed }: { feed: FeedEntry[] }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [feed.length]);
  return (
    <div className="panel">
      <div className="panel-header">
        <div className="title">
          <span className="pre">[05]</span> LIVE FEED{" "}
          <span className="pre">// #deploys</span>
        </div>
        <div className="right">
          <span
            className="live-dot"
            style={{ display: "inline-block", marginRight: 6 }}
          />
          <span style={{ color: "var(--green)" }}>DISCORD &middot; CONNECTED</span>
        </div>
      </div>
      <div className="panel-body" style={{ position: "relative" }}>
        <div className="fade-edge-top" />
        <div className="feed" ref={ref}>
          {feed.map((l, i) => (
            <FeedLine key={i} line={l} />
          ))}
        </div>
      </div>
    </div>
  );
}
