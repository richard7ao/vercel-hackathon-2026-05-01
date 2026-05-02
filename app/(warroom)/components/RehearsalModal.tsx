"use client";

import { useState, useCallback, useRef, useEffect } from "react";

type TraceStep = {
  ts: string;
  label: string;
  status: "pending" | "running" | "done" | "error";
  detail?: string;
};

type Rehearsal = {
  sha: string;
  action: "ack" | "hold" | "page";
  status: "idle" | "triggering" | "waiting_pause" | "paused" | "resuming" | "done" | "error";
  trace: TraceStep[];
  verdict?: Record<string, unknown>;
  error?: string;
};

const ACTION_LABELS: Record<string, { label: string; cls: string }> = {
  ack: { label: "ACKNOWLEDGE", cls: "" },
  hold: { label: "HOLD ROLLBACK", cls: "primary" },
  page: { label: "PAGE @ONCALL", cls: "danger" },
};

function ts(): string {
  return new Date().toISOString().slice(11, 19);
}

export function RehearsalModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [rehearsals, setRehearsals] = useState<Rehearsal[]>([]);
  const [running, setRunning] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [rehearsals]);

  const addTrace = useCallback((idx: number, step: TraceStep) => {
    setRehearsals((prev) =>
      prev.map((r, i) => (i === idx ? { ...r, trace: [...r.trace, step] } : r))
    );
  }, []);

  const updateRehearsal = useCallback((idx: number, patch: Partial<Rehearsal>) => {
    setRehearsals((prev) =>
      prev.map((r, i) => (i === idx ? { ...r, ...patch } : r))
    );
  }, []);

  const updateLastTrace = useCallback((idx: number, patch: Partial<TraceStep>) => {
    setRehearsals((prev) =>
      prev.map((r, i) => {
        if (i !== idx || r.trace.length === 0) return r;
        const trace = [...r.trace];
        trace[trace.length - 1] = { ...trace[trace.length - 1], ...patch };
        return { ...r, trace };
      })
    );
  }, []);

  const pollKV = useCallback(async (key: string, timeoutMs: number, signal: AbortSignal): Promise<string | null> => {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (signal.aborted) return null;
      try {
        const res = await fetch(`/api/internal/kv?key=${encodeURIComponent(key)}`, {
          headers: { "x-kv-secret": "bridge-kv-dev" },
          signal,
        });
        if (res.ok) {
          const { value } = await res.json();
          if (value !== null && value !== undefined) return typeof value === "string" ? value : JSON.stringify(value);
        }
      } catch {
        if (signal.aborted) return null;
      }
      await new Promise((r) => setTimeout(r, 2000));
    }
    return null;
  }, []);

  const runAll = useCallback(async () => {
    const actions: Array<"ack" | "hold" | "page"> = ["ack", "hold", "page"];
    const initial: Rehearsal[] = actions.map((action) => ({
      sha: `reh_${Date.now().toString(36)}_${action}`,
      action,
      status: "idle",
      trace: [],
    }));
    setRehearsals(initial);
    setRunning(true);
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    for (let i = 0; i < actions.length; i++) {
      if (ctrl.signal.aborted) break;

      const sha = initial[i].sha;
      const action = actions[i];

      updateRehearsal(i, { status: "triggering" });
      addTrace(i, { ts: ts(), label: "POST /api/demo/trigger", status: "running" });

      try {
        const trigRes = await fetch("/api/demo/trigger", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${await getToken()}` },
          body: JSON.stringify({ sha, score: 0.9 }),
          signal: ctrl.signal,
        });

        if (!trigRes.ok) {
          updateLastTrace(i, { status: "error", detail: `${trigRes.status}` });
          updateRehearsal(i, { status: "error", error: `trigger: ${trigRes.status}` });
          continue;
        }
        updateLastTrace(i, { status: "done", detail: "200 OK" });

        updateRehearsal(i, { status: "waiting_pause" });
        addTrace(i, { ts: ts(), label: "polling pause_state", status: "running" });

        const pauseVal = await pollKV(`pause_state:${sha}`, 90_000, ctrl.signal);
        if (!pauseVal) {
          updateLastTrace(i, { status: "error", detail: "timeout 90s" });
          updateRehearsal(i, { status: "error", error: "pause_state not found" });
          continue;
        }
        updateLastTrace(i, { status: "done", detail: `found in KV` });

        updateRehearsal(i, { status: "paused" });
        addTrace(i, { ts: ts(), label: `hook paused · token=deploy:ack:${sha}`, status: "done" });

        addTrace(i, { ts: ts(), label: "polling verdicts (pre-resume)", status: "running" });
        const preVerdict = await pollKV(`verdicts:${sha}`, 10_000, ctrl.signal);
        updateLastTrace(i, {
          status: "done",
          detail: preVerdict ? JSON.parse(preVerdict).level ?? "found" : "pending",
        });

        updateRehearsal(i, { status: "resuming" });
        addTrace(i, { ts: ts(), label: `POST /api/demo/resume · action=${action}`, status: "running" });

        const resRes = await fetch("/api/demo/resume", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${await getToken()}` },
          body: JSON.stringify({ deploy_id: sha, action_type: action, username: `rehearsal-ui` }),
          signal: ctrl.signal,
        });

        if (!resRes.ok) {
          updateLastTrace(i, { status: "error", detail: `${resRes.status}` });
          updateRehearsal(i, { status: "error", error: `resume: ${resRes.status}` });
          continue;
        }
        updateLastTrace(i, { status: "done", detail: "200 OK" });

        addTrace(i, { ts: ts(), label: "polling verdicts (post-resume)", status: "running" });
        await new Promise((r) => setTimeout(r, 3000));
        const postVerdict = await pollKV(`verdicts:${sha}`, 15_000, ctrl.signal);
        if (postVerdict) {
          const parsed = JSON.parse(postVerdict);
          updateLastTrace(i, { status: "done", detail: parsed.level ?? "ok" });
          updateRehearsal(i, { status: "done", verdict: parsed });
        } else {
          updateLastTrace(i, { status: "done", detail: "no update" });
          updateRehearsal(i, { status: "done" });
        }

        addTrace(i, { ts: ts(), label: "cleanup check", status: "running" });
        const remainingPause = await pollKV(`pause_state:${sha}`, 3_000, ctrl.signal);
        updateLastTrace(i, {
          status: "done",
          detail: remainingPause ? "pause_state still present" : "pause_state cleaned",
        });
      } catch (err) {
        if (ctrl.signal.aborted) break;
        updateRehearsal(i, { status: "error", error: String(err) });
      }
    }

    setRunning(false);
  }, [addTrace, updateRehearsal, updateLastTrace, pollKV]);

  const handleClose = useCallback(() => {
    if (abortRef.current) abortRef.current.abort();
    setRunning(false);
    onClose();
  }, [onClose]);

  if (!open) return null;

  const allDone = rehearsals.length === 3 && rehearsals.every((r) => r.status === "done" || r.status === "error");
  const passCount = rehearsals.filter((r) => r.status === "done").length;

  return (
    <div className="rehearsal-overlay" onClick={handleClose}>
      <div className="rehearsal-modal" onClick={(e) => e.stopPropagation()}>
        <div className="rehearsal-head">
          <span>PRODUCTION REHEARSAL</span>
          <button className="x" onClick={handleClose}>[ X ]</button>
        </div>

        <div className="rehearsal-body" ref={logRef}>
          {rehearsals.length === 0 && (
            <div className="rehearsal-empty">
              <p>Run all three action types against the live deployment:</p>
              <div className="rehearsal-actions-preview">
                {(["ack", "hold", "page"] as const).map((a) => (
                  <span key={a} className={`rehearsal-action-chip ${ACTION_LABELS[a].cls}`}>
                    {ACTION_LABELS[a].label}
                  </span>
                ))}
              </div>
              <p className="rehearsal-sub">
                Each rehearsal triggers a full workflow: webhook → investigators →
                synthesizer → Hook pause → resume → verdict. Live traces shown below.
              </p>
            </div>
          )}

          {rehearsals.map((r, i) => (
            <div key={r.sha} className="rehearsal-run">
              <div className="rehearsal-run-head">
                <span className={`rehearsal-action-chip ${ACTION_LABELS[r.action].cls}`}>
                  {ACTION_LABELS[r.action].label}
                </span>
                <span className="rehearsal-sha">{r.sha}</span>
                <span className={`rehearsal-status rehearsal-status-${r.status}`}>
                  {r.status === "done" ? "PASS" : r.status === "error" ? "FAIL" : r.status.replace("_", " ").toUpperCase()}
                </span>
              </div>
              <div className="rehearsal-trace">
                {r.trace.map((t, j) => (
                  <div key={j} className={`trace-line trace-${t.status}`}>
                    <span className="trace-ts">{t.ts}</span>
                    <span className={`trace-dot trace-dot-${t.status}`} />
                    <span className="trace-label">{t.label}</span>
                    {t.detail && <span className="trace-detail">{t.detail}</span>}
                  </div>
                ))}
              </div>
              {r.error && <div className="rehearsal-error">{r.error}</div>}
            </div>
          ))}

          {allDone && (
            <div className="rehearsal-summary">
              {passCount}/{rehearsals.length} PASSED
            </div>
          )}
        </div>

        <div className="rehearsal-foot">
          {!running && !allDone && (
            <button className="btn primary" onClick={runAll}>
              ▶ RUN ALL 3 REHEARSALS
            </button>
          )}
          {running && (
            <button className="btn danger" onClick={() => abortRef.current?.abort()}>
              ■ ABORT
            </button>
          )}
          {allDone && (
            <button className="btn primary" onClick={runAll}>
              ↺ RE-RUN
            </button>
          )}
          <button className="btn" onClick={handleClose}>
            CLOSE
          </button>
        </div>
      </div>
    </div>
  );
}

async function getToken(): Promise<string> {
  return (window as unknown as Record<string, string>).__DEMO_TOKEN ?? "bridge-demo-2026";
}
