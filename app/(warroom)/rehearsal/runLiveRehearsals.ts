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

async function postDemoJson(
  url: string,
  body: object,
  signal: AbortSignal
): Promise<Response> {
  return fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${await getDemoToken()}`,
    },
    body: JSON.stringify(body),
    signal,
  });
}

async function pollKV(
  key: string,
  timeoutMs: number,
  signal: AbortSignal
): Promise<string | null> {
  const start = Date.now();
  const bearer = `Bearer ${await getDemoToken()}`;
  while (Date.now() - start < timeoutMs) {
    if (signal.aborted) return null;
    try {
      const res = await fetch(
        `/api/demo/kv?key=${encodeURIComponent(key)}`,
        { headers: { Authorization: bearer }, signal }
      );
      if (res.ok) {
        const { value } = (await res.json()) as { value: string | null };
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

async function revertCanaryQuiet(signal: AbortSignal): Promise<void> {
  try {
    const res = await postDemoJson(
      "/api/demo/git-rehearsal",
      { action: "revert" },
      signal
    );
    if (!res.ok) {
      console.warn("[rehearsal] revert failed:", res.status);
    }
  } catch {
    /* ignore */
  }
}

/**
 * Runs three rehearsals (ack, hold, page): each pushes a real vulnerable-looking
 * canary commit to the monitored repo (GitHub webhook → watchdog → agents → hook),
 * waits for `pause_state`, resumes via `/api/demo/resume`, then reverts the canary
 * so the next run can repeat.
 */
export async function runLiveRehearsals(
  signal: AbortSignal,
  notify: (rows: RehearsalRow[]) => void
): Promise<{ passCount: number; total: number }> {
  const actions: Array<"ack" | "hold" | "page"> = ["ack", "hold", "page"];
  const rows: RehearsalRow[] = actions.map((action) => ({
    sha: `pending-${action}`,
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

    const action = actions[i];
    let commitSha: string | null = null;

    patchRow(i, { status: "triggering" });
    addTrace(i, {
      ts: clockTs(),
      label: "POST /api/demo/git-rehearsal · inject canary",
      status: "running",
    });

    try {
      const injRes = await postDemoJson(
        "/api/demo/git-rehearsal",
        { action: "inject" },
        signal
      );

      if (!injRes.ok) {
        const t = await injRes.text().catch(() => "");
        patchLastTrace(i, { status: "error", detail: `${injRes.status}` });
        patchRow(i, {
          status: "error",
          error: `inject: ${injRes.status} ${t.slice(0, 240)}`,
        });
        continue;
      }

      const injBody = (await injRes.json()) as { sha?: string };
      commitSha = injBody.sha ?? null;
      if (!commitSha) {
        patchLastTrace(i, { status: "error", detail: "no sha in response" });
        patchRow(i, { status: "error", error: "inject: missing commit sha" });
        continue;
      }

      patchRow(i, { sha: commitSha });
      patchLastTrace(i, {
        status: "done",
        detail: `pushed ${commitSha.slice(0, 7)} → webhook`,
      });

      addTrace(i, {
        ts: clockTs(),
        label: "wait GitHub webhook + watchdog (4s)",
        status: "done",
      });
      await new Promise((r) => setTimeout(r, 4000));

      patchRow(i, { status: "waiting_pause" });
      addTrace(i, { ts: clockTs(), label: "polling pause_state", status: "running" });

      const pauseVal = await pollKV(`pause_state:${commitSha}`, 120_000, signal);
      if (!pauseVal) {
        patchLastTrace(i, { status: "error", detail: "timeout 120s" });
        patchRow(i, { status: "error", error: "pause_state not found" });
        await revertCanaryQuiet(signal);
        continue;
      }
      patchLastTrace(i, { status: "done", detail: "found in KV" });

      patchRow(i, { status: "paused" });
      addTrace(i, {
        ts: clockTs(),
        label: `hook paused · deploy:ack:${commitSha.slice(0, 7)}…`,
        status: "done",
      });

      addTrace(i, {
        ts: clockTs(),
        label: "polling verdicts (pre-resume)",
        status: "running",
      });
      const preVerdict = await pollKV(`verdicts:${commitSha}`, 15_000, signal);
      patchLastTrace(i, {
        status: "done",
        detail: preVerdict
          ? (JSON.parse(preVerdict) as { level?: string }).level ?? "found"
          : "pending",
      });

      patchRow(i, { status: "resuming" });
      addTrace(i, {
        ts: clockTs(),
        label: `POST /api/demo/resume · action=${action}`,
        status: "running",
      });

      const resRes = await postDemoJson(
        "/api/demo/resume",
        {
          deploy_id: commitSha,
          action_type: action,
          username: "rehearsal-ui",
        },
        signal
      );

      if (!resRes.ok) {
        patchLastTrace(i, { status: "error", detail: `${resRes.status}` });
        patchRow(i, { status: "error", error: `resume: ${resRes.status}` });
        await revertCanaryQuiet(signal);
        continue;
      }
      patchLastTrace(i, { status: "done", detail: "200 OK" });

      addTrace(i, {
        ts: clockTs(),
        label: "polling verdicts (post-resume)",
        status: "running",
      });
      await new Promise((r) => setTimeout(r, 3000));
      const postVerdict = await pollKV(`verdicts:${commitSha}`, 15_000, signal);
      if (postVerdict) {
        const parsed = JSON.parse(postVerdict) as Record<string, unknown>;
        patchLastTrace(i, { status: "done", detail: String(parsed.level ?? "ok") });
        patchRow(i, { status: "done", verdict: parsed });
      } else {
        patchLastTrace(i, { status: "done", detail: "no update" });
        patchRow(i, { status: "done" });
      }

      addTrace(i, {
        ts: clockTs(),
        label: "POST /api/demo/git-rehearsal · revert canary",
        status: "running",
      });
      const revRes = await postDemoJson(
        "/api/demo/git-rehearsal",
        { action: "revert" },
        signal
      );
      patchLastTrace(i, {
        status: revRes.ok ? "done" : "error",
        detail: revRes.ok ? "repo reset for next run" : String(revRes.status),
      });

      addTrace(i, { ts: clockTs(), label: "cleanup pause_state", status: "running" });
      const remainingPause = await pollKV(`pause_state:${commitSha}`, 3_000, signal);
      patchLastTrace(i, {
        status: "done",
        detail: remainingPause ? "pause_state still present" : "pause_state cleaned",
      });
    } catch (err) {
      if (signal.aborted) break;
      patchRow(i, { status: "error", error: String(err) });
      if (commitSha) await revertCanaryQuiet(signal);
    }
  }

  const passCount = rows.filter((r) => r.status === "done").length;
  return { passCount, total: rows.length };
}
