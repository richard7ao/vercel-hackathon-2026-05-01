"use client";

import { useReducer, useEffect, useCallback, useRef, useState } from "react";
import {
  type SSEEvent,
  type StatusEvent,
  type DeployEvent,
  type InvestigatorEvent,
  type FeedEvent,
  type VerdictEvent,
  type ThreatSurfaceEvent,
  parseSSEEvent,
} from "@/lib/sse-events";
import { useDemo } from "./useDemo";

type WarRoomState = {
  state: StatusEvent["state"];
  uptime_seconds: number;
  deploys_analyzed: number;
  deploys: DeployEvent[];
  investigators: Record<string, InvestigatorEvent>;
  agents: Record<string, InvestigatorEvent>;
  feed: FeedEvent[];
  verdict: VerdictEvent | null;
  threats: ThreatSurfaceEvent["items"];
};

export const initialState: WarRoomState = {
  state: "all_clear",
  uptime_seconds: 0,
  deploys_analyzed: 0,
  deploys: [],
  investigators: {},
  agents: {},
  feed: [],
  verdict: null,
  threats: [],
};

export function reducer(state: WarRoomState, event: SSEEvent): WarRoomState {
  switch (event.type) {
    case "status":
      return {
        ...state,
        state: event.state,
        uptime_seconds: event.uptime_seconds,
        deploys_analyzed: event.deploys_analyzed,
      };
    case "deploy": {
      const exists = state.deploys.some((d) => d.id === event.id);
      return {
        ...state,
        deploys: exists
          ? state.deploys.map((d) => (d.id === event.id ? event : d))
          : [...state.deploys, event],
      };
    }
    case "investigator":
      return {
        ...state,
        investigators: {
          ...state.investigators,
          [`${event.deploy_id}:${event.agent}`]: event,
        },
        agents: {
          ...state.agents,
          [event.agent]: event,
        },
      };
    case "feed":
      return {
        ...state,
        feed: [...state.feed.slice(-99), event],
      };
    case "verdict":
      return { ...state, verdict: event };
    case "threat_surface":
      return { ...state, threats: event.items };
    default:
      return state;
  }
}

export function useDeploysSSE() {
  const [mode, setModeState] = useState<"demo" | "live">(() => {
    if (typeof window === "undefined") return "demo";
    const stored = localStorage.getItem("bridge.mode");
    if (stored === "live") return "live";
    const params = new URLSearchParams(window.location.search);
    if (params.get("live") === "1") return "live";
    return "demo";
  });

  const [liveState, dispatch] = useReducer(reducer, initialState);
  const esRef = useRef<EventSource | null>(null);

  const setMode = useCallback((m: "demo" | "live") => {
    setModeState(m);
    if (typeof window !== "undefined") {
      localStorage.setItem("bridge.mode", m);
    }
  }, []);

  useEffect(() => {
    if (mode !== "live") {
      if (esRef.current) {
        esRef.current.close();
        esRef.current = null;
      }
      return;
    }

    const es = new EventSource("/api/stream/deploys");
    esRef.current = es;

    const handler = (msg: MessageEvent) => {
      const event = parseSSEEvent(`data: ${msg.data}`);
      if (event) dispatch(event);
    };

    es.onmessage = handler;
    for (const t of [
      "deploy",
      "verdict",
      "investigator",
      "feed",
      "threat_surface",
      "status",
    ]) {
      es.addEventListener(t, handler);
    }

    return () => {
      es.close();
      esRef.current = null;
    };
  }, [mode]);

  const demo = useDemo(mode);

  if (mode === "demo") {
    return { ...demo, mode, setMode };
  }

  return {
    state: liveState.state,
    uptime: liveState.uptime_seconds,
    deploysAnalyzed: liveState.deploys_analyzed,
    agentsStanding: 5,
    mtta: "—",
    deploys: liveState.deploys.map((d) => ({
      id: d.id,
      sha: d.sha.slice(0, 7),
      author: d.author,
      pushed_at: d.pushed_at,
      score: d.score,
      tldr: d.tldr,
      files_changed: d.files_changed,
    })),
    activeDeploy: null,
    setActiveDeploy: () => {},
    agents: Object.fromEntries(
      Object.values(liveState.agents).map((a) => [
        a.agent,
        {
          status: a.status,
          lines: a.current_action
            ? [
                {
                  ts: new Date().toISOString(),
                  text: a.current_action,
                  cur: a.status !== "complete",
                },
              ]
            : [],
          steps: a.status === "complete" ? 1 : 0,
          tokens: 0,
          latency: "—",
          finding: a.finding,
        },
      ])
    ),
    feed: liveState.feed.map((f) => ({
      ts: f.ts,
      severity: f.severity,
      kind: "sys" as const,
      message: f.message,
    })),
    heatmap: [],
    peakCell: null,
    threats: liveState.threats.map((t) => ({
      id: t.id,
      severity: t.severity,
      description: t.description,
      age_seconds: t.age_seconds,
      status: t.status as "open" | "resolved",
    })),
    verdict: liveState.verdict
      ? {
          level: liveState.verdict.level,
          summary: liveState.verdict.summary,
          concerns: liveState.verdict.concerns,
          action: liveState.verdict.suggested_action,
        }
      : null,
    setVerdict: () => {},
    running: true,
    runDemo: () => {},
    reset: () => {},
    loopState: "playing" as const,
    nextPlayInMs: 0,
    mode,
    setMode,
  };
}
