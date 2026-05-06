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

export type GitRehearsalDemoResult =
  | { ok: true; action: "inject"; sha: string; path?: string }
  | { ok: true; action: "revert"; noop?: boolean; path?: string }
  | { ok: false; status: number; message: string };

/** One-shot git rehearsal API (same as automated runner uses). */
export async function gitRehearsalDemo(
  action: "inject" | "revert",
  signal?: AbortSignal
): Promise<GitRehearsalDemoResult> {
  const eff = signal ?? new AbortController().signal;
  const res = await postDemoJson(
    "/api/demo/git-rehearsal",
    { action },
    eff
  );
  const text = await res.text().catch(() => "");
  if (!res.ok) {
    return { ok: false, status: res.status, message: text.slice(0, 240) };
  }
  try {
    const j = JSON.parse(text) as Record<string, unknown>;
    if (action === "inject" && typeof j.sha === "string") {
      return {
        ok: true,
        action: "inject",
        sha: j.sha,
        path: typeof j.path === "string" ? j.path : undefined,
      };
    }
    if (action === "revert") {
      return {
        ok: true,
        action: "revert",
        noop: Boolean(j.noop),
        path: typeof j.path === "string" ? j.path : undefined,
      };
    }
  } catch {
    /* fall through */
  }
  return { ok: false, status: res.status, message: "bad JSON from git-rehearsal" };
}

export type DiscordPingDemoResult =
  | { ok: true; message_id: string }
  | { ok: false; status: number; message: string };

/** POST /api/demo/discord-ping — @here + embed in DISCORD_CHANNEL_ID. */
export async function discordPingDemo(
  signal?: AbortSignal
): Promise<DiscordPingDemoResult> {
  const eff = signal ?? new AbortController().signal;
  const res = await postDemoJson("/api/demo/discord-ping", {}, eff);
  const text = await res.text().catch(() => "");
  if (!res.ok) {
    return { ok: false, status: res.status, message: text.slice(0, 240) };
  }
  try {
    const j = JSON.parse(text) as { message_id?: string };
    if (typeof j.message_id === "string") {
      return { ok: true, message_id: j.message_id };
    }
  } catch {
    /* fall through */
  }
  return { ok: false, status: res.status, message: "bad JSON from discord-ping" };
}

export type LlmSmokeDemoResult =
  | { ok: true; preview: string; llm?: string }
  | { ok: false; status: number; message: string };

/** POST /api/demo/llm-smoke — one generateText via getGateway(). */
export async function llmSmokeDemo(
  signal?: AbortSignal
): Promise<LlmSmokeDemoResult> {
  const eff = signal ?? new AbortController().signal;
  const res = await postDemoJson("/api/demo/llm-smoke", {}, eff);
  const text = await res.text().catch(() => "");
  if (!res.ok) {
    return { ok: false, status: res.status, message: text.slice(0, 240) };
  }
  try {
    const j = JSON.parse(text) as {
      ok?: boolean;
      preview?: string;
      llm?: string;
      error?: string;
    };
    if (j.ok && typeof j.preview === "string") {
      return { ok: true, preview: j.preview, llm: j.llm };
    }
    if (j.error) {
      return { ok: false, status: res.status, message: j.error };
    }
  } catch {
    /* fall through */
  }
  return { ok: false, status: res.status, message: "bad JSON from llm-smoke" };
}

export type DemoTriggerResult =
  | { ok: true; sha: string; score?: number }
  | { ok: false; status: number; message: string };

/** POST /api/demo/trigger — start watchdog with _force_score (no GitHub webhook). */
export async function demoTriggerWatchdog(
  opts?: { score?: number; sha?: string; signal?: AbortSignal }
): Promise<DemoTriggerResult> {
  const eff = opts?.signal ?? new AbortController().signal;
  const body: Record<string, unknown> = {};
  if (opts?.score !== undefined) body.score = opts.score;
  if (opts?.sha !== undefined) body.sha = opts.sha;
  const res = await postDemoJson("/api/demo/trigger", body, eff);
  const text = await res.text().catch(() => "");
  if (!res.ok) {
    return { ok: false, status: res.status, message: text.slice(0, 240) };
  }
  try {
    const j = JSON.parse(text) as { sha?: string; score?: number };
    if (typeof j.sha === "string") {
      return { ok: true, sha: j.sha, score: j.score };
    }
  } catch {
    /* fall through */
  }
  return { ok: false, status: res.status, message: "bad JSON from trigger" };
}

export type DemoResetResult =
  | { ok: true; reset_at?: string; noop?: boolean; reason?: string }
  | { ok: false; status: number; message: string };

/** POST /api/demo/reset — full KV cleanup (or agent-only via `scope: "agents"`). */
export async function demoResetKv(
  scope: "all" | "agents" = "all",
  signal?: AbortSignal
): Promise<DemoResetResult> {
  const eff = signal ?? new AbortController().signal;
  const res = await postDemoJson("/api/demo/reset", { scope }, eff);
  const text = await res.text().catch(() => "");
  if (!res.ok) {
    return { ok: false, status: res.status, message: text.slice(0, 240) };
  }
  try {
    const j = JSON.parse(text) as {
      reset_at?: string;
      noop?: boolean;
      reason?: string;
    };
    return {
      ok: true,
      reset_at: j.reset_at,
      noop: j.noop,
      reason: j.reason,
    };
  } catch {
    return { ok: true };
  }
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
    const triggerSha = `reh_${Date.now().toString(36)}_${action}`;

    patchRow(i, { status: "triggering", sha: triggerSha });
    addTrace(i, {
      ts: clockTs(),
      label: "POST /api/demo/trigger · start watchdog",
      status: "running",
    });

    try {
      const trigRes = await postDemoJson(
        "/api/demo/trigger",
        { sha: triggerSha, score: 0.9 },
        signal
      );

      if (!trigRes.ok) {
        const t = await trigRes.text().catch(() => "");
        patchLastTrace(i, { status: "error", detail: `${trigRes.status}` });
        patchRow(i, { status: "error", error: `trigger: ${trigRes.status} ${t.slice(0, 240)}` });
        continue;
      }
      patchLastTrace(i, { status: "done", detail: "watchdog started" });

      patchRow(i, { status: "waiting_pause" });
      addTrace(i, { ts: clockTs(), label: "polling pause_state", status: "running" });

      const pauseVal = await pollKV(`pause_state:${triggerSha}`, 90_000, signal);
      if (!pauseVal) {
        patchLastTrace(i, { status: "error", detail: "timeout 90s" });
        patchRow(i, { status: "error", error: "pause_state not found" });
        continue;
      }
      patchLastTrace(i, { status: "done", detail: "found in KV" });

      patchRow(i, { status: "paused" });
      addTrace(i, {
        ts: clockTs(),
        label: `hook paused · deploy:ack:${triggerSha.slice(0, 12)}…`,
        status: "done",
      });

      addTrace(i, {
        ts: clockTs(),
        label: "polling verdicts (pre-resume)",
        status: "running",
      });
      const preVerdict = await pollKV(`verdicts:${triggerSha}`, 15_000, signal);
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
        { deploy_id: triggerSha, action_type: action, username: "rehearsal-ui" },
        signal
      );

      if (!resRes.ok) {
        patchLastTrace(i, { status: "error", detail: `${resRes.status}` });
        patchRow(i, { status: "error", error: `resume: ${resRes.status}` });
        continue;
      }
      patchLastTrace(i, { status: "done", detail: "200 OK" });

      addTrace(i, {
        ts: clockTs(),
        label: "polling verdicts (post-resume)",
        status: "running",
      });
      await new Promise((r) => setTimeout(r, 3000));
      const postVerdict = await pollKV(`verdicts:${triggerSha}`, 15_000, signal);
      if (postVerdict) {
        const parsed = JSON.parse(postVerdict) as Record<string, unknown>;
        patchLastTrace(i, { status: "done", detail: String(parsed.level ?? "ok") });
        patchRow(i, { status: "done", verdict: parsed });
      } else {
        patchLastTrace(i, { status: "done", detail: "no update" });
        patchRow(i, { status: "done" });
      }

      addTrace(i, { ts: clockTs(), label: "cleanup pause_state", status: "running" });
      const remainingPause = await pollKV(`pause_state:${triggerSha}`, 3_000, signal);
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
