"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  type AgentFinding,
  type AgentState,
  type Deploy,
  type FeedEntry,
  type StatusState,
  type Threat,
  type Verdict,
  INITIAL_DEPLOYS,
  INITIAL_FEED,
  INITIAL_HEATMAP,
  INITIAL_THREATS,
  initAgents,
  nowTs,
} from "../data";
import { discordPingDemo } from "../rehearsal/runLiveRehearsals";

type LoopPhase = "playing" | "holding" | "paused-by-user";

const LOOP_HOLD_MS = 8000;
const PAUSE_RESUME_MS = 30000;

const AGENT_TOOLS: Record<string, string> = {
  trace: "otlp.query",
  runtime: "metrics.q",
  history: "git.log",
  dependency: "sbom.diff",
  diff: "ast.walk",
};

export function computeLoopState(input: {
  phase: string;
  mode: string;
  sinceMs: number;
}): string {
  const { phase, mode, sinceMs } = input;
  if (phase === "initial") {
    return sinceMs >= 3000 ? "playing" : "playing-pending";
  }
  if (mode === "live") return phase;
  if (phase === "holding") {
    return sinceMs >= LOOP_HOLD_MS ? "playing" : "holding";
  }
  if (phase === "paused-by-user") {
    return sinceMs >= PAUSE_RESUME_MS ? "playing" : "paused-by-user";
  }
  return phase;
}

export function computeNextPlayInMs(input: {
  sinceMs: number;
  holdMs: number;
  mode?: string;
}): number | null {
  if (input.mode === "live") return null;
  return Math.max(0, input.holdMs - input.sinceMs);
}

export function useDemo(mode: "demo" | "live" = "demo") {
  const [state, setState] = useState<StatusState>("all_clear");
  const [uptime, setUptime] = useState(12 * 86400 + 4 * 3600 + 11 * 60);
  const [deploysAnalyzed, setDeploysAnalyzed] = useState(47);
  const [agentsStanding, setAgentsStanding] = useState(5);
  const [mtta, setMtta] = useState("1.2s");

  const [deploys, setDeploys] = useState<Deploy[]>(INITIAL_DEPLOYS);
  const [activeDeploy, setActiveDeploy] = useState<Deploy | null>(null);

  const [agents, setAgents] = useState<Record<string, AgentState>>(initAgents);

  const [feed, setFeed] = useState<FeedEntry[]>(INITIAL_FEED);

  const [heatmap, setHeatmap] = useState(INITIAL_HEATMAP);
  const [peakCell, setPeakCell] = useState<{ r: number; c: number } | null>(
    null
  );

  const [threats, setThreats] = useState<Threat[]>(INITIAL_THREATS);
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [budgetPct, setBudgetPct] = useState(100);
  const [running, setRunning] = useState(false);
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const [loopState, setLoopState_] = useState<LoopPhase>("playing");
  const [nextPlayInMs, setNextPlayInMs] = useState(0);
  const loopStateRef = useRef<LoopPhase>("playing");
  const holdStartRef = useRef(0);
  const loopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pauseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const replayFlagRef = useRef(false);

  const setLoopState = useCallback((s: LoopPhase) => {
    loopStateRef.current = s;
    setLoopState_(s);
  }, []);

  const at = useCallback((sec: number, fn: () => void) => {
    const id = setTimeout(fn, sec * 1000);
    timeoutsRef.current.push(id);
  }, []);

  const clearAll = useCallback(() => {
    timeoutsRef.current.forEach(clearTimeout);
    timeoutsRef.current = [];
  }, []);

  const clearLoopTimers = useCallback(() => {
    if (loopTimerRef.current) clearTimeout(loopTimerRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
    if (pauseTimerRef.current) clearTimeout(pauseTimerRef.current);
    loopTimerRef.current = null;
    countdownRef.current = null;
    pauseTimerRef.current = null;
  }, []);

  useEffect(() => {
    const i = setInterval(() => setUptime((u) => u + 1), 1000);
    return () => clearInterval(i);
  }, []);

  const setAgent = useCallback(
    (
      key: string,
      patch:
        | Partial<AgentState>
        | ((prev: AgentState) => Partial<AgentState>)
    ) => {
      setAgents((prev) => ({
        ...prev,
        [key]: {
          ...prev[key],
          ...(typeof patch === "function" ? patch(prev[key]) : patch),
        },
      }));
    },
    []
  );

  const pushAgentLine = useCallback((key: string, text: string) => {
    setAgents((prev) => {
      const a = prev[key];
      const lines = (a.lines || []).map((l) => ({ ...l, cur: false }));
      lines.push({ ts: nowTs(), text, cur: true });
      return {
        ...prev,
        [key]: {
          ...a,
          lines,
          steps: (a.steps || 0) + 1,
          tokens: (a.tokens || 0) + Math.floor(80 + Math.random() * 220),
        },
      };
    });
  }, []);

  const finalizeAgent = useCallback(
    (key: string, finding: AgentFinding, latency: string) => {
      setAgents((prev) => {
        const a = prev[key];
        const lines = (a.lines || []).map((l) => ({ ...l, cur: false }));
        return {
          ...prev,
          [key]: {
            ...a,
            status: "complete",
            lines,
            finding,
            latency,
          },
        };
      });
    },
    []
  );

  const pushFeed = useCallback((entry: Omit<FeedEntry, "ts">) => {
    setFeed((prev) => [...prev, { ts: nowTs(), ...entry } as FeedEntry]);
  }, []);

  const resetDemoState = useCallback(() => {
    clearAll();
    setRunning(false);
    setState("all_clear");
    setDeploys(INITIAL_DEPLOYS);
    setActiveDeploy(null);
    setDeploysAnalyzed(47);
    setAgents(initAgents());
    setFeed(INITIAL_FEED);
    setHeatmap(INITIAL_HEATMAP);
    setPeakCell(null);
    setThreats(INITIAL_THREATS);
    setVerdict(null);
    setBudgetPct(100);
    setMtta("1.2s");
  }, [clearAll]);

  const reset = useCallback(() => {
    const wasHolding =
      loopStateRef.current === "holding" ||
      loopStateRef.current === "paused-by-user";
    clearLoopTimers();
    resetDemoState();
    if (mode === "demo" && wasHolding) {
      setLoopState("paused-by-user");
      setNextPlayInMs(0);
      pauseTimerRef.current = setTimeout(() => {
        replayFlagRef.current = true;
        resetDemoState();
        setLoopState("playing");
      }, PAUSE_RESUME_MS);
    }
  }, [resetDemoState, clearLoopTimers, mode, setLoopState]);

  const runDemoRef = useRef<() => void>(() => {});

  const runDemo = useCallback(() => {
    if (running) return;
    clearAll();
    clearLoopTimers();
    setRunning(true);
    setVerdict(null);
    setLoopState("playing");
    setNextPlayInMs(0);

    void discordPingDemo().then((r) => {
      if (r.ok) {
        pushFeed({
          severity: "info",
          kind: "bot",
          message: `demo start · discord @here ping sent (msg ${r.message_id.slice(0, 8)}…)`,
        });
      } else {
        pushFeed({
          severity: "warn",
          kind: "bot",
          message: `demo start · discord ping failed (${r.status}) — check DISCORD_* env or LIVE control`,
        });
      }
    });

    const newDeploy: Deploy = {
      id: "dep_048",
      sha: "a4f2c91",
      author: "dev-3",
      pushed_at: new Date().toISOString(),
      tldr: "refactor auth, add metrics emitter",
      score: 0.0,
      files_changed: [
        "lib/auth.ts",
        "lib/auth/session.ts",
        "lib/observability/emit.ts",
      ],
    };

    at(0.4, () => {
      pushFeed({
        severity: "info",
        kind: "sys",
        message: "demo scenario armed · injecting synthetic deploy stream",
      });
    });

    at(2, () => {
      pushFeed({
        severity: "info",
        kind: "msg",
        author: "dev-3",
        message: "pushing the auth refactor real quick before standup",
      });
      pushFeed({
        severity: "info",
        kind: "bot",
        message:
          "push detected · sha `a4f2c91` · `lib/auth.ts` +2 files · author `dev-3`",
      });
    });

    at(3, () => {
      setState("monitoring");
      setDeploys((prev) => [...prev, { ...newDeploy, score: 0.05 }]);
      setActiveDeploy({ ...newDeploy, score: 0.05 });
      setDeploysAnalyzed(48);
      pushFeed({
        severity: "warn",
        kind: "bot",
        message:
          "scoring `a4f2c91` · structural · behavioral · temporal signals…",
      });
    });

    at(4, () => {
      setDeploys((prev) =>
        prev.map((d) => (d.id === "dep_048" ? { ...d, score: 0.91 } : d))
      );
      setActiveDeploy((prev) => (prev ? { ...prev, score: 0.91 } : prev));
      setState("critical");
      pushFeed({
        severity: "critical",
        kind: "bot",
        message:
          "risk score `0.91` // structural=0.88 · behavioral=0.72 · temporal=0.94 · compounds=author-novelty + off-hours",
      });
      setMtta("0.7s");
    });

    const order = ["trace", "runtime", "history", "dependency", "diff"];
    order.forEach((k, i) => {
      at(5 + i * 0.15, () => {
        setAgent(k, {
          status: "dispatched",
          lines: [
            {
              ts: nowTs(),
              text: "dispatch ack · waking workflow…",
              cur: false,
            },
          ],
        });
      });
    });
    at(5.4, () => setBudgetPct(92));
    at(5.4, () =>
      pushFeed({
        severity: "warn",
        kind: "bot",
        message:
          "dispatching 5 investigator agents in parallel · workflow `wf_88a2`",
      })
    );

    order.forEach((k, i) => {
      at(6 + i * 0.12, () => {
        setAgent(k, (prev) => ({
          ...prev,
          status: "investigating",
          tool: AGENT_TOOLS[k],
        }));
      });
    });

    const streams: Record<string, string[]> = {
      trace: [
        "GET /traces?service=auth&since=15m",
        "parsed 12,418 spans across 3 services",
        "comparing span graph to 7d baseline · no novel patterns",
      ],
      runtime: [
        "GET /metrics/p95?route=/login",
        "p50 unchanged · p95 +6ms · within σ band",
        "memory rss flat · gc cycles nominal",
      ],
      history: [
        "git log --author=dev-3 -- lib/auth.ts",
        "0 prior commits to lib/auth/* by `dev-3`",
        "cross-ref CODEOWNERS · `dev-3` not on auth team",
      ],
      dependency: [
        "sbom.diff sha:a4f2c91 vs main",
        "no new packages · 0 transitive added",
        "lockfile clean · integrity hashes match",
      ],
      diff: [
        "ast.walk lib/auth.ts · 184 nodes",
        "detected new fetch() at line 247",
        "destination `https://stats-collector.io/track` · NOT in allowlist",
      ],
    };
    Object.entries(streams).forEach(([k, lines]) => {
      lines.forEach((text, i) => {
        at(7 + i * 1.5 + Math.random() * 0.3, () => pushAgentLine(k, text));
      });
    });

    at(8, () => setBudgetPct(78));
    at(10, () => setBudgetPct(61));
    at(12, () => setBudgetPct(44));

    at(13, () => {
      setBudgetPct(38);
      finalizeAgent(
        "trace",
        {
          severity: "low",
          summary:
            "No new error patterns. Trace topology matches 7d baseline.",
        },
        "4.8s"
      );
      pushFeed({
        severity: "info",
        kind: "bot",
        message: "`trace` complete · benign · 4.8s",
      });
    });
    at(14, () => {
      setBudgetPct(31);
      finalizeAgent(
        "history",
        {
          severity: "critical",
          summary:
            "Author has never modified auth code · not in CODEOWNERS.",
        },
        "5.1s"
      );
      pushFeed({
        severity: "critical",
        kind: "bot",
        message:
          "`history` complete · `dev-3` has 0 prior commits to `lib/auth/*` // novel author",
      });
    });
    at(15, () => {
      setBudgetPct(25);
      finalizeAgent(
        "dependency",
        {
          severity: "low",
          summary: "No new dependencies. Lockfile integrity clean.",
        },
        "3.7s"
      );
      pushFeed({
        severity: "info",
        kind: "bot",
        message: "`dependency` complete · benign · 3.7s",
      });
    });
    at(16, () => {
      setBudgetPct(21);
      finalizeAgent(
        "diff",
        {
          severity: "critical",
          summary:
            "New external fetch() to `stats-collector.io` · NOT allowlisted.",
        },
        "6.2s"
      );
      pushFeed({
        severity: "critical",
        kind: "bot",
        message:
          "`diff` complete // exfil candidate: `https://stats-collector.io/track` injected at `lib/auth.ts:247`",
      });
      setPeakCell({ r: 1, c: 29 });
    });
    at(17, () => {
      setBudgetPct(18);
      finalizeAgent(
        "runtime",
        {
          severity: "medium",
          summary: "No runtime anomalies yet. Window: last 4 minutes.",
        },
        "7.0s"
      );
      pushFeed({
        severity: "warn",
        kind: "bot",
        message:
          "`runtime` complete · provisional · 7.0s · window too short for confident verdict",
      });
    });

    at(18, () => {
      setVerdict({
        level: "critical",
        deploy_id_short: "048",
        summary:
          "Synthesizer collapses 5 inspector findings into a high-confidence verdict: this push contains an unannounced exfil channel inside the auth path, authored by a contributor with no prior history in this code area.",
        concerns: [
          "New external fetch() to `stats-collector.io` injected at lib/auth.ts:247 — not in allowlist.",
          "Author `dev-3` has 0 prior commits to lib/auth/*; not in CODEOWNERS for this path.",
          "Push at 03:42 UTC is outside the team's normal commit window (P10–P90 = 14:00–22:00 UTC).",
        ],
        action:
          "Hold the deploy at 0% rollout. Page @oncall-security. Open incident channel and request a forced-revert.",
        suggested_action:
          "Hold the deploy at 0% rollout. Page @oncall-security. Open incident channel and request a forced-revert.",
        acknowledged: false,
      });
      pushFeed({
        severity: "critical",
        kind: "bot",
        message:
          "synthesizer verdict ready · level=`CRITICAL` · 3 concerns · see verdict panel →",
      });
    });

    at(19, () => {
      setThreats((prev) => [
        {
          id: "th_NEW",
          severity: "critical",
          description:
            "Unauthorized `fetch()` to external host injected in auth path",
          age_seconds: 0,
          status: "open",
        },
        {
          id: "th_002",
          severity: "high",
          description:
            "Author novelty // `dev-3` modifying CODEOWNERS-protected path without review",
          age_seconds: 60,
          status: "open",
        },
        ...prev,
      ]);
    });

    at(20, () => {
      pushFeed({
        severity: "info",
        kind: "msg",
        author: "oncall-bot",
        message:
          "@dev-3 @sec-team please ack — auto-rollback held pending review",
      });
      pushFeed({
        severity: "critical",
        kind: "bot",
        message:
          "paging on-call · severity=SEV-1 · runbook `RB-auth-exfil` // [PAGE] @sec-oncall",
      });
    });
    at(21.5, () => {
      pushFeed({
        severity: "info",
        kind: "msg",
        author: "sec-oncall",
        message: "ack, on it. holding rollout at 0%. opening incident.",
      });
    });
    at(23, () => {
      pushFeed({
        severity: "warn",
        kind: "bot",
        message:
          "rollback armed · no traffic served · waiting on human approval",
      });
    });

    at(25, () => {
      pushFeed({
        severity: "info",
        kind: "sys",
        message: "demo hold · final state · press RESET to re-arm",
      });
      setRunning(false);

      if (mode === "demo") {
        setLoopState("holding");
        holdStartRef.current = Date.now();
        setNextPlayInMs(LOOP_HOLD_MS);

        countdownRef.current = setInterval(() => {
          const elapsed = Date.now() - holdStartRef.current;
          setNextPlayInMs(Math.max(0, LOOP_HOLD_MS - elapsed));
        }, 200);

        loopTimerRef.current = setTimeout(() => {
          clearLoopTimers();
          setNextPlayInMs(0);
          replayFlagRef.current = true;
          resetDemoState();
          setLoopState("playing");
        }, LOOP_HOLD_MS);
      }
    });
  }, [
    running,
    at,
    clearAll,
    pushAgentLine,
    finalizeAgent,
    pushFeed,
    setAgent,
    clearLoopTimers,
    mode,
    setLoopState,
    resetDemoState,
  ]);

  useEffect(() => {
    runDemoRef.current = runDemo;
  }, [runDemo]);

  useEffect(() => {
    if (replayFlagRef.current && !running && loopState === "playing") {
      replayFlagRef.current = false;
      const id = setTimeout(() => runDemoRef.current(), 50);
      return () => clearTimeout(id);
    }
  }, [running, loopState]);

  const auto = useRef(false);
  useEffect(() => {
    if (auto.current) return;
    auto.current = true;
    const t = setTimeout(() => runDemo(), 3000);
    return () => {
      clearTimeout(t);
      // React Strict Mode (dev) remounts after cleanup; reset so the demo still arms once.
      auto.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(
    () => () => {
      clearAll();
      clearLoopTimers();
    },
    [clearLoopTimers]
  );

  return {
    state,
    uptime,
    deploysAnalyzed,
    agentsStanding,
    mtta,
    deploys,
    activeDeploy,
    setActiveDeploy,
    agents,
    feed,
    heatmap,
    peakCell,
    threats,
    verdict,
    setVerdict,
    runDemo,
    reset,
    running,
    loopState,
    nextPlayInMs,
    budgetPct,
  };
}
