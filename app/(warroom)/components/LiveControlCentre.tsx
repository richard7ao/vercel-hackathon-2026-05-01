"use client";

import { useCallback, useState } from "react";
import {
  demoResetKv,
  demoTriggerWatchdog,
  discordPingDemo,
  gitRehearsalDemo,
  llmSmokeDemo,
} from "../rehearsal/runLiveRehearsals";

type LiveControlCentreProps = {
  boardRunning: boolean;
  traceRehearsalOpen: boolean;
  onOpenTrace: () => void;
  onStartBoardRehearsal: () => void;
};

type BusyKey =
  | "inject"
  | "revert"
  | "discord"
  | "llm"
  | "trigger"
  | "reset"
  | "reset-agents"
  | null;

export function LiveControlCentre({
  boardRunning,
  traceRehearsalOpen,
  onOpenTrace,
  onStartBoardRehearsal,
}: LiveControlCentreProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [busy, setBusy] = useState<BusyKey>(null);
  const [hint, setHint] = useState("");

  const anyApiBusy = busy !== null;
  const blockRehearsal = boardRunning || anyApiBusy || traceRehearsalOpen;

  const run = useCallback(
    async (key: BusyKey, fn: () => Promise<void>) => {
      setBusy(key);
      setHint("");
      try {
        await fn();
      } finally {
        setBusy(null);
      }
    },
    []
  );

  return (
    <aside
      className={`live-ctrl-centre${collapsed ? " live-ctrl-centre--collapsed" : ""}`}
      aria-label="Live control centre"
    >
      <div className="live-ctrl-centre-head">
        <span className="live-ctrl-centre-title tab-num">LIVE CONTROL CENTRE</span>
        <button
          type="button"
          className="live-ctrl-centre-toggle tab-num"
          onClick={() => setCollapsed((c) => !c)}
          aria-expanded={!collapsed}
        >
          {collapsed ? "[ + ]" : "[ − ]"}
        </button>
      </div>

      {!collapsed && (
        <>
          <div className="live-ctrl-centre-section">
            <span className="live-ctrl-centre-label tab-num">GIT · CANARY</span>
            <div className="live-ctrl-centre-row">
              <button
                type="button"
                className="btn"
                disabled={anyApiBusy || boardRunning}
                title="POST /api/demo/git-rehearsal · inject"
                onClick={() =>
                  void run("inject", async () => {
                    const r = await gitRehearsalDemo("inject");
                    if (r.ok && r.action === "inject") {
                      setHint(`git inject · ${r.sha.slice(0, 7)} · ${r.path ?? ""}`);
                    } else if (!r.ok) {
                      setHint(`git inject · ${r.status} ${r.message}`);
                    }
                  })
                }
              >
                {busy === "inject" ? "…" : "⎆ PUSH CANARY"}
              </button>
              <button
                type="button"
                className="btn"
                disabled={anyApiBusy || boardRunning}
                title="POST /api/demo/git-rehearsal · revert"
                onClick={() =>
                  void run("revert", async () => {
                    const r = await gitRehearsalDemo("revert");
                    if (r.ok && r.action === "revert") {
                      setHint(
                        r.noop ? "git revert · noop" : `git revert · ${r.path ?? "ok"}`
                      );
                    } else if (!r.ok) {
                      setHint(`git revert · ${r.status} ${r.message}`);
                    }
                  })
                }
              >
                {busy === "revert" ? "…" : "↩ REVERT CANARY"}
              </button>
            </div>
          </div>

          <div className="live-ctrl-centre-section">
            <span className="live-ctrl-centre-label tab-num">DISCORD</span>
            <div className="live-ctrl-centre-row">
              <button
                type="button"
                className="btn"
                disabled={anyApiBusy || boardRunning}
                title="POST /api/demo/discord-ping · @here + embed"
                onClick={() =>
                  void run("discord", async () => {
                    const r = await discordPingDemo();
                    if (r.ok) {
                      setHint(`discord · msg ${r.message_id.slice(0, 8)}…`);
                    } else {
                      setHint(`discord · ${r.status} ${r.message}`);
                    }
                  })
                }
              >
                {busy === "discord" ? "…" : "◇ PING @here"}
              </button>
            </div>
          </div>

          <div className="live-ctrl-centre-section">
            <span className="live-ctrl-centre-label tab-num">AI · SMOKE</span>
            <div className="live-ctrl-centre-row">
              <button
                type="button"
                className="btn"
                disabled={anyApiBusy || boardRunning}
                title="POST /api/demo/llm-smoke · generateText via getGateway()"
                onClick={() =>
                  void run("llm", async () => {
                    const r = await llmSmokeDemo();
                    if (r.ok) {
                      setHint(
                        `llm · ${r.llm ?? "?"} · ${r.preview.slice(0, 48)}${r.preview.length > 48 ? "…" : ""}`
                      );
                    } else if (!r.ok) {
                      setHint(`llm · ${r.status} ${r.message}`);
                    }
                  })
                }
              >
                {busy === "llm" ? "…" : "◆ TEST LLM"}
              </button>
            </div>
          </div>

          <div className="live-ctrl-centre-section">
            <span className="live-ctrl-centre-label tab-num">WORKFLOW</span>
            <div className="live-ctrl-centre-row live-ctrl-centre-row--stack">
              <button
                type="button"
                className="btn"
                disabled={anyApiBusy || boardRunning}
                title="POST /api/demo/trigger · watchdog with _force_score (no webhook)"
                onClick={() =>
                  void run("trigger", async () => {
                    const r = await demoTriggerWatchdog({ score: 0.9 });
                    if (r.ok) {
                      setHint(`trigger · ${r.sha.slice(0, 12)}… score ${r.score ?? 0.9}`);
                    } else {
                      setHint(`trigger · ${r.status} ${r.message}`);
                    }
                  })
                }
              >
                {busy === "trigger" ? "…" : "⚡ TRIGGER WATCHDOG"}
              </button>
              <button
                type="button"
                className="btn primary"
                disabled={blockRehearsal}
                title="Visual trace modal · 3× ack/hold/page"
                onClick={onOpenTrace}
              >
                ◈ TRACE VIEW
              </button>
              <button
                type="button"
                className="btn"
                disabled={boardRunning || anyApiBusy}
                title="Board dock · git webhook path · 3× rehearsal"
                onClick={() => onStartBoardRehearsal()}
              >
                ◈ BOARD REHEARSAL
              </button>
            </div>
          </div>

          <div className="live-ctrl-centre-section live-ctrl-centre-section--danger">
            <span className="live-ctrl-centre-label tab-num">MAINT · DANGER</span>
            <div className="live-ctrl-centre-row live-ctrl-centre-row--stack">
              <button
                type="button"
                className="btn"
                disabled={anyApiBusy || boardRunning}
                title="POST /api/demo/reset · scope=agents — clears investigator/signal/pause_state only"
                onClick={() =>
                  void run("reset-agents", async () => {
                    const r = await demoResetKv("agents");
                    if (r.ok) {
                      setHint(`reset agents · ${r.reset_at ?? "ok"}`);
                    } else {
                      setHint(`reset agents · ${r.status} ${r.message}`);
                    }
                  })
                }
              >
                {busy === "reset-agents" ? "…" : "↻ RESET INVESTIGATORS"}
              </button>
              <button
                type="button"
                className="btn danger"
                disabled={anyApiBusy || boardRunning}
                title="POST /api/demo/reset · full KV cleanup (deploys/verdicts/threats/agents)"
                onClick={() =>
                  void run("reset", async () => {
                    const r = await demoResetKv("all");
                    if (r.ok) {
                      setHint(
                        r.noop
                          ? `reset · noop — ${r.reason ?? "skipped"}`
                          : `reset · ${r.reset_at ?? "ok"}`
                      );
                    } else {
                      setHint(`reset · ${r.status} ${r.message}`);
                    }
                  })
                }
              >
                {busy === "reset" ? "…" : "⚠ KV RESET (full)"}
              </button>
            </div>
          </div>

          {hint ? (
            <p className="live-ctrl-centre-hint tab-num" aria-live="polite">
              {hint}
            </p>
          ) : null}
        </>
      )}
    </aside>
  );
}
