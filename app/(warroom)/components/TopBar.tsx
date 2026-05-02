"use client";

import { useState, useEffect } from "react";
import type { Deploy } from "../data";

const REPO = process.env.NEXT_PUBLIC_MONITORED_REPO || "meridian/core-banking";

export function TopBar({ activeDeploy }: { activeDeploy: Deploy | null }) {
  const [t, setT] = useState(new Date());
  useEffect(() => {
    const i = setInterval(() => setT(new Date()), 1000);
    return () => clearInterval(i);
  }, []);
  const utc = t.toISOString().slice(11, 19);
  const date = t.toISOString().slice(0, 10);

  return (
    <div className="topbar">
      <div className="topbar-left">
        <span className="brand">
          BRIDGE<span className="slash">//</span>
          <span className="sub">PRODUCTION WAR ROOM</span>
        </span>
        <span className="crumb">
          REPO <b>{REPO}</b>
        </span>
        <span className="crumb">
          BRANCH <b>main</b>
        </span>
        <span className="crumb">
          REGION <b>iad1 &middot; sfo1 &middot; fra1</b>
        </span>
      </div>
      <div className="topbar-right">
        {activeDeploy ? (
          <span className="crumb">
            FOCUS <b>{activeDeploy.sha}</b> &middot;{" "}
            <span className="path">{activeDeploy.tldr}</span>
          </span>
        ) : (
          <span className="crumb">
            FOCUS{" "}
            <b className="dim">&mdash; no active investigation &mdash;</b>
          </span>
        )}
        <span className="live-badge">
          <span className="live-dot" />
          LIVE
        </span>
        <span className="clock tab-num">
          {date} {utc} UTC
        </span>
      </div>
    </div>
  );
}
