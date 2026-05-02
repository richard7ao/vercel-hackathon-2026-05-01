/**
 * Shared live rehearsal runner: trigger → pause → resume for ack/hold/page.
 * Used by the trace modal and the on-dashboard rehearsal dock.
 */

export type TraceStep = {
  ts: string;
  label: string;
  status: "pending" | "running" | "done" | "error";
  detail?: string;
};

export type RehearsalRow = {
  sha: string;
  action: "ack" | "hold" | "page";
  status:
    | "idle"
    | "triggering"
    | "waiting_pause"
    | "paused"
    | "resuming"
    | "done"
    | "error";
  trace: TraceStep[];
  verdict?: Record<string, unknown>;
  error?: string;
};

function clockTs(): string {
  return new Date().toISOString().slice(11, 19);
}

function cloneRows(rows: RehearsalRow[]): RehearsalRow[] {
  return rows.map((r) => ({
    ...r,
    trace: r.trace.map((t) => ({ ...t })),
  }));
}

export async function getDemoToken(): Promise<string> {
  if (typeof window !== "undefined") {
    const w = window as unknown as Record<string, string>;
    return w.__DEMO_TOKEN ?? "bridge-demo-2026";
  }
  return "bridge-demo-2026";
}

async function pollKV(
  key: string,
  timeoutMs: number,
  signal: AbortSignal
): Promise<string | null> {
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
        if (value !== null && value !== undefined) {
          return typeof value === "string" ? value : JSON.stringify(value);
        }
      }
    } catch {
      if (signal.aborted) return null;
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  return null;
}

/** Runs three rehearsals (ack, hold, page). Calls `notify` after each state change with a fresh snapshot. */
export async function runLiveRehearsals(
  signal: AbortSignal,
  notify: (rows: RehearsalRow[]) => void
): Promise<{ passCount: number; total: number }> {
  const actions: Array<"ack" | "hold" | "page"> = ["ack", "hold", "page"];
  const rows: RehearsalRow[] = actions.map((action) => ({
    sha: `reh_${Date.now().toString(36)}_${action}_${Math.random().toString(36).slice(2, 6)}`,
    action,
    status: "idle",
    trace: [],
  }));
  notify(cloneRows(rows));

  const addTrace = (idx: number, step: TraceStep) => {
    rows[idx] = { ...rows[idx], trace: [...rows[idx].trace, step] };
    notify(cloneRows(rows));
  };

  const patchRow = (idx: number, patch: Partial<RehearsalRow>) => {
    rows[idx] = { ...rows[idx], ...patch };
    notify(cloneRows(rows));
  };

  const patchLastTrace = (idx: number, patch: Partial<TraceStep>) => {
    const trace = [...rows[idx].trace];
    if (trace.length === 0) return;
    trace[trace.length - 1] = { ...trace[trace.length - 1], ...patch };
    rows[idx] = { ...rows[idx], trace };
    notify(cloneRows(rows));
  };

  for (let i = 0; i < actions.length; i++) {
    if (signal.aborted) break;

    const sha = rows[i].sha;
    const action = actions[i];

    patchRow(i, { status: "triggering" });
    addTrace(i, { ts: clockTs(), label: "POST /api/demo/trigger", status: "running" });

    try {
      const trigRes = await fetch("/api/demo/trigger", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${await getDemoToken()}`,
        },
        body: JSON.stringify({ sha, score: 0.9 }),
        signal,
      });

      if (!trigRes.ok) {
        patchLastTrace(i, { status: "error", detail: `${trigRes.status}` });
        patchRow(i, { status: "error", error: `trigger: ${trigRes.status}` });
        continue;
      }
      patchLastTrace(i, { status: "done", detail: "200 OK" });

      patchRow(i, { status: "waiting_pause" });
      addTrace(i, { ts: clockTs(), label: "polling pause_state", status: "running" });

      const pauseVal = await pollKV(`pause_state:${sha}`, 90_000, signal);
      if (!pauseVal) {
        patchLastTrace(i, { status: "error", detail: "timeout 90s" });
        patchRow(i, { status: "error", error: "pause_state not found" });
        continue;
      }
      patchLastTrace(i, { status: "done", detail: "found in KV" });

      patchRow(i, { status: "paused" });
      addTrace(i, {
        ts: clockTs(),
        label: `hook paused · token=deploy:ack:${sha}`,
        status: "done",
      });

      addTrace(i, { ts: clockTs(), label: "polling verdicts (pre-resume)", status: "running" });
      const preVerdict = await pollKV(`verdicts:${sha}`, 10_000, signal);
      patchLastTrace(i, {
        status: "done",
        detail: preVerdict ? JSON.parse(preVerdict).level ?? "found" : "pending",
      });

      patchRow(i, { status: "resuming" });
      addTrace(i, {
        ts: clockTs(),
        label: `POST /api/demo/resume · action=${action}`,
        status: "running",
      });

      const resRes = await fetch("/api/demo/resume", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${await getDemoToken()}`,
        },
        body: JSON.stringify({
          deploy_id: sha,
          action_type: action,
          username: `rehearsal-ui`,
        }),
        signal,
      });

      if (!resRes.ok) {
        patchLastTrace(i, { status: "error", detail: `${resRes.status}` });
        patchRow(i, { status: "error", error: `resume: ${resRes.status}` });
        continue;
      }
      patchLastTrace(i, { status: "done", detail: "200 OK" });

      addTrace(i, { ts: clockTs(), label: "polling verdicts (post-resume)", status: "running" });
      await new Promise((r) => setTimeout(r, 3000));
      const postVerdict = await pollKV(`verdicts:${sha}`, 15_000, signal);
      if (postVerdict) {
        const parsed = JSON.parse(postVerdict);
        patchLastTrace(i, { status: "done", detail: parsed.level ?? "ok" });
        patchRow(i, { status: "done", verdict: parsed });
      } else {
        patchLastTrace(i, { status: "done", detail: "no update" });
        patchRow(i, { status: "done" });
      }

      addTrace(i, { ts: clockTs(), label: "cleanup check", status: "running" });
      const remainingPause = await pollKV(`pause_state:${sha}`, 3_000, signal);
      patchLastTrace(i, {
        status: "done",
        detail: remainingPause ? "pause_state still present" : "pause_state cleaned",
      });
    } catch (err) {
      if (signal.aborted) break;
      patchRow(i, { status: "error", error: String(err) });
    }
  }

  const passCount = rows.filter((r) => r.status === "done").length;
  return { passCount, total: rows.length };
}
