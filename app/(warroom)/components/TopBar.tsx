"use client";

import { useState, useEffect } from "react";
import type { Deploy } from "../data";
import { ModeToggle } from "./ModeToggle";
import { DEFAULT_MONITORED_REPO } from "@/lib/monitored-repo";

/** Display + ingest target: same GitHub repo webhooks and `gh` flows use (`owner/name`). */
const REPO =
  process.env.NEXT_PUBLIC_MONITORED_REPO ||
  process.env.NEXT_PUBLIC_DEMO_GITHUB_REPO ||
  DEFAULT_MONITORED_REPO;
const GH_DEMO_REPO =
  process.env.NEXT_PUBLIC_DEMO_GITHUB_REPO ||
  process.env.NEXT_PUBLIC_MONITORED_REPO ||
  DEFAULT_MONITORED_REPO;

type WorkflowInfo = {
  id: string;
  resumed: number;
  runtime_minutes: number;
};

export function TopBar({
  activeDeploy,
  workflow,
  mode,
  onModeToggle,
}: {
  activeDeploy: Deploy | null;
  workflow?: WorkflowInfo | null;
  mode?: "demo" | "live";
  onModeToggle?: () => void;
}) {
  const [t, setT] = useState(new Date());
  useEffect(() => {
    const i = setInterval(() => setT(new Date()), 1000);
    return () => clearInterval(i);
  }, []);
  const iso = t.toISOString();
  const utc = iso.slice(11, 19);
  const date = iso.slice(0, 10);

  return (
    <div className="topbar">
      <div className="topbar-left">
        <span className="brand">
          BRIDGE<span className="slash">//</span>
          <span className="sub">PRODUCTION WAR ROOM</span>
        </span>
        <span
          className="crumb"
          title="Monitored GitHub repo (MONITORED_REPO / NEXT_PUBLIC_MONITORED_REPO)"
        >
          REPO <b>{REPO}</b>
        </span>
        <span
          className="crumb"
          title="GitHub URL — webhook push events from this repository"
        >
          GH{" "}
          <b>
            <a
              href={`https://github.com/${GH_DEMO_REPO}`}
              target="_blank"
              rel="noreferrer"
              className="path"
            >
              {GH_DEMO_REPO}
            </a>
          </b>
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
        {workflow && (
          <span className="crumb workflow-line">
            WORKFLOW <b>{workflow.id}</b> &middot; resumed{" "}
            {workflow.resumed}x &middot; {workflow.runtime_minutes.toFixed(1)}m
            runtime
          </span>
        )}
        <ModeToggle
          mode={mode ?? "demo"}
          sseStatus={mode === "live" ? "connected" : "idle"}
          onToggle={onModeToggle}
        />
        <span className="clock tab-num">
          {date} {utc} UTC
        </span>
      </div>
    </div>
  );
}
