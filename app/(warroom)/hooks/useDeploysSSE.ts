"use client";

import { useReducer, useEffect, useCallback, useRef, useState } from "react";
import { getDemoToken } from "../rehearsal/runLiveRehearsals";
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

const LIVE_SSE_EVENTS = [
  "deploy",
  "verdict",
  "investigator",
  "feed",
  "threat_surface",
  "status",
] as const;

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
      const deploys = exists
        ? state.deploys.map((d) => (d.id === event.id ? event : d))
        : [...state.deploys, event];
      const feedLine: FeedEvent = {
        type: "feed",
        deploy_id: event.id,
        ts: event.pushed_at,
        severity: "info",
        message: `Deploy ${event.sha.slice(0, 7)} · ${event.tldr}`,
      };
      return {
        ...state,
        deploys,
        feed: exists ? state.feed : [...state.feed.slice(-80), feedLine],
      };
    }
    case "investigator": {
      const next = {
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
      if (event.status !== "complete") return next;
      const feedLine: FeedEvent = {
        type: "feed",
        deploy_id: event.deploy_id,
        ts: new Date().toISOString(),
        severity:
          event.finding?.severity === "critical" ? "critical" : "info",
        message: `${event.agent.toUpperCase()} · ${event.finding?.summary ?? "complete"}`,
      };
      return {
        ...next,
        feed: [...next.feed.slice(-80), feedLine],
      };
    }
    case "feed":
      return {
        ...state,
        feed: [...state.feed.slice(-99), event],
      };
    case "verdict": {
      const feedLine: FeedEvent = {
        type: "feed",
        deploy_id: event.deploy_id,
        ts: new Date().toISOString(),
        severity: event.level === "critical" ? "critical" : "info",
        message: `VERDICT · ${event.level.toUpperCase()} · ${event.summary.slice(0, 120)}`,
      };
      return {
        ...state,
        verdict: event,
        feed: [...state.feed.slice(-80), feedLine],
      };
    }
    case "threat_surface":
      return { ...state, threats: event.items };
    default:
      return state;
  }
}

export function resolveInitialMode(input: {
  search: string;
  localStorageMode: string | null;
}): "demo" | "live" {
  const params = new URLSearchParams(input.search);
  const urlLive = params.get("live");
  if (urlLive === "1") return "live";
  if (urlLive === "0") return "demo";
  if (input.localStorageMode === "live") return "live";
  if (input.localStorageMode === "demo") return "demo";
  return "demo";
}

export function useDeploysSSE() {
  const [mode, setModeState] = useState<"demo" | "live">(() => {
    if (typeof window === "undefined") return "demo";
    return resolveInitialMode({
      search: window.location.search,
      localStorageMode: localStorage.getItem("bridge.mode"),
    });
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
    for (const t of LIVE_SSE_EVENTS) {
      es.addEventListener(t, handler);
    }

    return () => {
      es.close();
      esRef.current = null;
    };
  }, [mode]);

  const demo = useDemo(mode);

  const resumeVerdictAction = useCallback(
    async (action_type: "ack" | "hold" | "page") => {
      const v = liveState.verdict;
      if (!v?.deploy_id) {
        throw new Error("No deploy_id on verdict — cannot resume hook");
      }
      const res = await fetch("/api/demo/resume", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${await getDemoToken()}`,
        },
        body: JSON.stringify({
          deploy_id: v.deploy_id,
          action_type,
          username: "war-room-live",
        }),
      });
      if (!res.ok) {
        const t = await res.text().catch(() => "");
        throw new Error(`resume ${res.status}${t ? `: ${t.slice(0, 120)}` : ""}`);
      }
    },
    [liveState.verdict]
  );

  if (mode === "demo") {
    return { ...demo, mode, setMode, resumeVerdictAction: undefined };
  }

  const v = liveState.verdict;
  const verdictMapped = v
    ? {
        level: v.level,
        summary: v.summary,
        concerns: v.concerns,
        action: v.suggested_action,
        suggested_action: v.suggested_action,
        deploy_id: v.deploy_id,
        deploy_id_short:
          v.deploy_id.length > 8 ? v.deploy_id.slice(-8) : v.deploy_id,
        acknowledged: Boolean(
          v.acknowledged ??
            (v as { acknowledged_at?: string }).acknowledged_at
        ),
        acknowledged_by: v.acknowledged_by,
        action_taken: v.action_taken,
      }
    : null;

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
    verdict: verdictMapped,
    setVerdict: () => {},
    running: true,
    runDemo: () => {},
    reset: () => {},
    loopState: "playing" as const,
    nextPlayInMs: 0,
    budgetPct: 100,
    mode,
    setMode,
    resumeVerdictAction,
  };
}
