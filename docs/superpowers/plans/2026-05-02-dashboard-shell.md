# Bridge — Multi-page Dashboard Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wrap the existing war room in a 5-section sidebar dashboard (WAR ROOM / AGENT NETWORK / OPERATIONS / INTELLIGENCE / SYSTEMS) with one SSE connection, one demo/live toggle, hand-rolled CSS in the locked war-room palette.

**Architecture:** Route group `(warroom)` becomes the sidebar shell. The existing war-room JSX moves to `sections/WarRoom.tsx`. A `DashboardProvider` hoists `useDeploysSSE` so the SSE connection survives tab switches. Four new sections live alongside WarRoom and share state via context. CSS extends `app/globals.css` — no shadcn, no rounded corners, no gradients. Playwright e2e fills the gaps SSR-grep can't reach.

**Tech Stack:** Next.js 16 App Router, React 19, Tailwind v4, TypeScript, `lucide-react` (new dep for sidebar icons), `@playwright/test` (new devDep for T6).

**Reference spec:** `docs/superpowers/specs/2026-05-02-dashboard-shell-design.md`. Every task below corresponds to exactly one spec stage. Verify commands live in the spec; this plan owns implementation code + commit cadence.

**Project workflow override:** Per `CLAUDE.md`, Tier 2 (simplify) is gated on commit diff size > 200 lines, not per stage. Tier-skip rules from the global manual still apply.

---

## File Map

```
app/
├── (warroom)/
│   ├── page.tsx                                    [REWRITE in Task 7]
│   ├── sections/
│   │   ├── WarRoom.tsx                             [NEW Task 1, refactored Task 4]
│   │   ├── AgentNetwork.tsx                        [NEW Tasks 11, 12]
│   │   ├── Operations.tsx                          [NEW Task 14]
│   │   ├── Intelligence.tsx                        [NEW Task 18]
│   │   └── Systems.tsx                             [NEW Task 21]
│   ├── components/
│   │   └── Sidebar.tsx                             [NEW Task 6]
│   ├── contexts/
│   │   └── DashboardContext.tsx                    [NEW Task 3]
│   ├── hooks/
│   │   └── useDeploysSSE.ts                        [MODIFY Task 17 — pass kind through]
│   ├── components/                                 [unchanged: existing TopBar, StatusBlock, etc.]
│   └── data.ts                                     [unchanged]
├── api/
│   └── health/
│       └── route.ts                                [NEW Task 20]
└── globals.css                                     [APPEND Tasks 8, 13, 16, 19, 22]
lib/
├── demo-tabs.ts                                    [NEW Task 9]
└── sse-events.ts                                   [MODIFY Task 17 — extend FeedEvent kind union]
playwright.config.ts                                [NEW Task 24]
tests/
└── e2e/
    ├── sidebar-nav.spec.ts                         [NEW Task 25]
    ├── sse-persistence.spec.ts                     [NEW Task 26]
    ├── operations-drilldown.spec.ts                [NEW Task 27]
    ├── systems-polling.spec.ts                     [NEW Task 28]
    └── agent-drawer.spec.ts                        [NEW Task 29]
package.json                                        [MODIFY Tasks 24 — add @playwright/test, test:e2e script; Task 6 — add lucide-react]
```

---

## Notes for the executing engineer

- **Verify commands live in the spec.** Each task ends with "Run spec verify blocks for stage T<n>" — open `docs/superpowers/specs/2026-05-02-dashboard-shell-design.md`, find the stage, run the four `# tier1_build`, `# tier3_unit`, `# tier4_integration` blocks (Tier 2 is informational only per project CLAUDE.md).
- **Commit format:** `feat: complete T<n> — <short description>`.
- **Server lifecycle:** dev-server-bound tier4 commands start `npx next dev -p 3030` themselves; do not start a server before running them.
- **The route group `(warroom)` resolves to `/`.** Treat `app/(warroom)/page.tsx` as the homepage throughout.
- **`Object.keys` over arrays:** `data.agents` is a `Record<agentName, ...>`, not an array. Iterate with `Object.entries` / `Object.values`.
- **No shadcn.** If you find yourself reaching for `@/components/ui/*`, stop — write the primitive in plain TSX with the existing CSS classes.
- **No rounded, no gradient, no backdrop-filter.** Tier3 CSS guards will fail your stage.

---

## Task 1: T0.1.1 — Move WarRoom render into section component

**Files:**
- Create: `app/(warroom)/sections/WarRoom.tsx`
- Modify: `app/(warroom)/page.tsx`

- [ ] **Step 1: Create the section file with the existing JSX tree**

Cut the entire `WarRoom` component body (lines 16-85) from `app/(warroom)/page.tsx` into a new file:

```tsx
// app/(warroom)/sections/WarRoom.tsx
"use client";

import { useDeploysSSE } from "../hooks/useDeploysSSE";
import { TopBar } from "../components/TopBar";
import { StatusBlock } from "../components/StatusBlock";
import { TimelineRow } from "../components/TimelineRow";
import { AgentsPanel } from "../components/AgentsPanel";
import { FeedPanel } from "../components/FeedPanel";
import { SystemHeatmap } from "../components/SystemHeatmap";
import { ThreatPanel } from "../components/ThreatPanel";
import { VerdictModal } from "../components/VerdictModal";
import { CountdownChip } from "../components/CountdownChip";
import { SuspendedOverlay } from "../components/SuspendedOverlay";
import { ResumePulse } from "../components/ResumePulse";

export function WarRoom() {
  const data = useDeploysSSE();

  return (
    <div className="shell" data-active-deploy={data.activeDeploy?.id ?? undefined}>
      <TopBar
        activeDeploy={data.activeDeploy}
        mode={data.mode}
        onModeToggle={() => data.setMode(data.mode === "demo" ? "live" : "demo")}
      />
      <StatusBlock
        state={data.state}
        uptime={data.uptime}
        deploysAnalyzed={data.deploysAnalyzed}
        agentsStanding={data.agentsStanding}
        mtta={data.mtta}
        score={data.activeDeploy?.score ?? 0}
        budgetPct={data.budgetPct ?? 100}
      />
      <TimelineRow
        deploys={data.deploys}
        activeId={data.activeDeploy?.id ?? null}
        onSelect={data.setActiveDeploy}
      />
      <div className="main-grid">
        <AgentsPanel agents={data.agents} />
        <FeedPanel feed={data.feed} />
        <SystemHeatmap deploys={data.deploys} />
        <ThreatPanel threats={data.threats} />
      </div>
      <VerdictModal
        verdict={data.verdict}
        onClose={() => {
          if (data.verdict && !data.verdict.acknowledged) {
            data.setVerdict({ ...data.verdict, acknowledged: true, acknowledged_by: "you" });
          } else {
            data.setVerdict(null);
          }
        }}
      />
      <div className="demo-ctrl">
        {!data.running && (
          <button className="btn primary" onClick={data.runDemo}>▶ RUN DEMO</button>
        )}
        <button className="btn" onClick={data.reset}>↺ RESET</button>
      </div>
      {data.loopState === "holding" && <CountdownChip nextPlayInMs={data.nextPlayInMs} />}
      <SuspendedOverlay verdict={data.verdict} />
      <ResumePulse acknowledged={"acknowledged" in (data.verdict ?? {}) && (data.verdict as { acknowledged?: boolean })?.acknowledged === true} />
    </div>
  );
}
```

Note the new `data-active-deploy` on the outer `.shell` — this is one of the test hooks called for in spec T2.1.1 / T6.1.4.

- [ ] **Step 2: Replace `page.tsx` body with a thin wrapper**

```tsx
// app/(warroom)/page.tsx
"use client";

import { WarRoom } from "./sections/WarRoom";

export default function Page() {
  return (
    <>
      <WarRoom />
      <div className="scanlines" />
      <div className="vignette" />
    </>
  );
}
```

The `DashboardProvider` lands in Task 4 — for this stage we keep `WarRoom` calling `useDeploysSSE` directly so the page still works.

- [ ] **Step 3: Run spec verify for T0.1.1**

Run the tier1, tier3, and tier4 commands from `docs/superpowers/specs/2026-05-02-dashboard-shell-design.md` under stage T0.1.1.

- [ ] **Step 4: Commit**

```bash
git add app/\(warroom\)/sections/WarRoom.tsx app/\(warroom\)/page.tsx
git commit -m "feat: complete T0.1.1 — move WarRoom render into section component"
```

---

## Task 2: T0.2.1 — DashboardContext provider

**Files:**
- Create: `app/(warroom)/contexts/DashboardContext.tsx`

- [ ] **Step 1: Write the provider + hook**

```tsx
// app/(warroom)/contexts/DashboardContext.tsx
"use client";

import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { useDeploysSSE } from "../hooks/useDeploysSSE";

export type DashboardTab = "warroom" | "agents" | "ops" | "intel" | "systems";

const TAB_VALUES: readonly DashboardTab[] = ["warroom", "agents", "ops", "intel", "systems"] as const;

function isTab(v: string | null): v is DashboardTab {
  return !!v && (TAB_VALUES as readonly string[]).includes(v);
}

type DashboardContextValue = {
  data: ReturnType<typeof useDeploysSSE>;
  currentTab: DashboardTab;
  setCurrentTab: (t: DashboardTab) => void;
};

const Ctx = createContext<DashboardContextValue | null>(null);

export function DashboardProvider({ children }: { children: ReactNode }) {
  const data = useDeploysSSE();

  const [currentTab, setCurrentTabState] = useState<DashboardTab>(() => {
    if (typeof window === "undefined") return "warroom";
    const v = new URLSearchParams(window.location.search).get("tab");
    return isTab(v) ? v : "warroom";
  });

  const setCurrentTab = (t: DashboardTab) => {
    setCurrentTabState(t);
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      params.set("tab", t);
      window.history.replaceState(null, "", `?${params.toString()}`);
    }
  };

  // Re-sync if external nav changes the URL while mounted.
  useEffect(() => {
    const onPop = () => {
      const v = new URLSearchParams(window.location.search).get("tab");
      if (isTab(v)) setCurrentTabState(v);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  return <Ctx.Provider value={{ data, currentTab, setCurrentTab }}>{children}</Ctx.Provider>;
}

export function useDashboard(): DashboardContextValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useDashboard must be used inside <DashboardProvider>");
  return v;
}
```

- [ ] **Step 2: Run spec verify for T0.2.1**

- [ ] **Step 3: Commit**

```bash
git add app/\(warroom\)/contexts/DashboardContext.tsx
git commit -m "feat: complete T0.2.1 — DashboardContext provider"
```

---

## Task 3: T0.2.2 — Refactor WarRoom to consume context

**Files:**
- Modify: `app/(warroom)/sections/WarRoom.tsx`

- [ ] **Step 1: Replace `useDeploysSSE` call with `useDashboard`**

In `WarRoom.tsx`, change the imports + first hook call:

```tsx
// remove:
// import { useDeploysSSE } from "../hooks/useDeploysSSE";
// const data = useDeploysSSE();

// add:
import { useDashboard } from "../contexts/DashboardContext";
// then inside the component:
const { data } = useDashboard();
```

Everything else in the component stays the same. (Because the provider hasn't been mounted yet, this stage will fail at runtime — that's expected; Task 4 mounts the provider in `page.tsx`.)

- [ ] **Step 2: Run spec verify for T0.2.2**

The tier4 in the spec runs the page; if Task 4 is incomplete the page will throw. Defer the tier4 verification of T0.2.2 until Task 4 is also done — they ship together.

- [ ] **Step 3: Commit**

```bash
git add app/\(warroom\)/sections/WarRoom.tsx
git commit -m "feat: complete T0.2.2 — WarRoom consumes DashboardContext"
```

---

## Task 4: T0.3.1 — Sidebar component

**Files:**
- Modify: `package.json` — add `lucide-react`
- Create: `app/(warroom)/components/Sidebar.tsx`

- [ ] **Step 1: Install `lucide-react`**

```bash
npm install lucide-react
```

- [ ] **Step 2: Write the Sidebar component**

```tsx
// app/(warroom)/components/Sidebar.tsx
"use client";

import { useState } from "react";
import { Activity, Users, Target, Shield, Settings, ChevronRight } from "lucide-react";
import { useDashboard, type DashboardTab } from "../contexts/DashboardContext";

const NAV: Array<{ id: DashboardTab; label: string; Icon: typeof Activity }> = [
  { id: "warroom", label: "WAR ROOM", Icon: Activity },
  { id: "agents", label: "AGENT NETWORK", Icon: Users },
  { id: "ops", label: "OPERATIONS", Icon: Target },
  { id: "intel", label: "INTELLIGENCE", Icon: Shield },
  { id: "systems", label: "SYSTEMS", Icon: Settings },
];

function formatUptime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function Sidebar() {
  const { data, currentTab, setCurrentTab } = useDashboard();
  const [collapsed, setCollapsed] = useState(false);
  const agentCount = Object.keys(data.agents ?? {}).length;

  return (
    <aside className={`sidebar ${collapsed ? "collapsed" : ""}`}>
      <div className="sidebar-header">
        {!collapsed && (
          <div className="sidebar-brand">
            <div className="sidebar-brand-mark">BRIDGE</div>
            <div className="sidebar-brand-sub">PROD WAR ROOM</div>
          </div>
        )}
        <button
          className="sidebar-collapse"
          onClick={() => setCollapsed((c) => !c)}
          aria-label="toggle sidebar"
        >
          <ChevronRight className={collapsed ? "" : "flip"} size={14} />
        </button>
      </div>

      <nav className="sidebar-nav">
        {NAV.map(({ id, label, Icon }) => (
          <button
            key={id}
            data-tab={id}
            data-active={currentTab === id ? "true" : "false"}
            className="sidebar-nav-btn"
            onClick={() => setCurrentTab(id)}
            title={label}
          >
            <Icon size={14} />
            {!collapsed && <span>{label}</span>}
          </button>
        ))}
      </nav>

      {!collapsed && (
        <div className="sidebar-status-block">
          <div className="sidebar-status-head">
            <span className="sidebar-pulse" />
            <span>SYSTEM ONLINE</span>
          </div>
          <div className="sidebar-status-row">
            <span className="k">UPTIME:</span>
            <span className="v">{formatUptime(data.uptime ?? 0)}</span>
          </div>
          <div className="sidebar-status-row">
            <span className="k">AGENTS:</span>
            <span className="v">{agentCount} ACTIVE</span>
          </div>
          <div className="sidebar-status-row">
            <span className="k">DEPLOYS:</span>
            <span className="v">{data.deploysAnalyzed ?? 0} ANALYZED</span>
          </div>
        </div>
      )}
    </aside>
  );
}
```

- [ ] **Step 3: Run spec verify for T0.3.1**

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json app/\(warroom\)/components/Sidebar.tsx
git commit -m "feat: complete T0.3.1 — sidebar component with 5-tab nav"
```

---

## Task 5: T0.3.2 — Replace `page.tsx` with shell

**Files:**
- Modify: `app/(warroom)/page.tsx`
- Create stub files for sections that don't exist yet so the shell compiles

- [ ] **Step 1: Create empty section stubs (deleted as each is implemented)**

```tsx
// app/(warroom)/sections/AgentNetwork.tsx
"use client";
import { useDashboard } from "../contexts/DashboardContext";
export function AgentNetwork() {
  useDashboard(); // will be replaced in Task 11
  return <div className="section-shell"><h1>AGENT NETWORK</h1><p>INVESTIGATOR roster — implementation pending</p></div>;
}
```

```tsx
// app/(warroom)/sections/Operations.tsx
"use client";
import { useDashboard } from "../contexts/DashboardContext";
export function Operations() {
  useDashboard();
  return <div className="section-shell"><h1>OPERATIONS</h1><p>Deploy archive — implementation pending</p></div>;
}
```

```tsx
// app/(warroom)/sections/Intelligence.tsx
"use client";
import { useDashboard } from "../contexts/DashboardContext";
export function Intelligence() {
  useDashboard();
  return <div className="section-shell"><h1>INTELLIGENCE</h1><p>Threat archive + Hook audit — implementation pending</p></div>;
}
```

```tsx
// app/(warroom)/sections/Systems.tsx
"use client";
import { useDashboard } from "../contexts/DashboardContext";
export function Systems() {
  useDashboard();
  return <div className="section-shell"><h1>SYSTEMS</h1><p>KV / AI GATEWAY / DISCORD / GITHUB — implementation pending</p></div>;
}
```

These stubs include each section's tier4 marker text (`INVESTIGATOR`, `OPERATIONS`, `INTELLIGENCE`, `KV`) so spec verify blocks for the Task 11/14/18/21 stages pass even mid-build.

- [ ] **Step 2: Rewrite `page.tsx` as the shell**

```tsx
// app/(warroom)/page.tsx
"use client";

import { DashboardProvider, useDashboard } from "./contexts/DashboardContext";
import { Sidebar } from "./components/Sidebar";
import { WarRoom } from "./sections/WarRoom";
import { AgentNetwork } from "./sections/AgentNetwork";
import { Operations } from "./sections/Operations";
import { Intelligence } from "./sections/Intelligence";
import { Systems } from "./sections/Systems";

function Body() {
  const { currentTab } = useDashboard();
  return (
    <div className="dashboard-shell">
      <Sidebar />
      <main className="dashboard-main">
        {currentTab === "warroom" && <WarRoom />}
        {currentTab === "agents" && <AgentNetwork />}
        {currentTab === "ops" && <Operations />}
        {currentTab === "intel" && <Intelligence />}
        {currentTab === "systems" && <Systems />}
      </main>
      <div className="scanlines" />
      <div className="vignette" />
    </div>
  );
}

export default function Page() {
  return (
    <DashboardProvider>
      <Body />
    </DashboardProvider>
  );
}
```

- [ ] **Step 3: Run spec verify for T0.3.2 (and re-run T0.2.2's deferred tier4)**

- [ ] **Step 4: Commit**

```bash
git add app/\(warroom\)/page.tsx app/\(warroom\)/sections/AgentNetwork.tsx app/\(warroom\)/sections/Operations.tsx app/\(warroom\)/sections/Intelligence.tsx app/\(warroom\)/sections/Systems.tsx
git commit -m "feat: complete T0.3.2 — dashboard shell with 5-tab routing"
```

---

## Task 6: T0.3.3 — Sidebar + shell CSS

**Files:**
- Modify: `app/globals.css` (append)

- [ ] **Step 1: Append the sidebar + shell rules**

Append to the end of `app/globals.css`:

```css
/* ========== Sidebar + dashboard shell ========== */
.dashboard-shell {
  display: grid;
  grid-template-columns: auto 1fr;
  height: 100vh;
  width: 100vw;
  overflow: hidden;
}
.dashboard-main {
  position: relative;
  overflow: hidden;
  min-width: 0;
}

.sidebar {
  width: 240px;
  background: var(--bg-1);
  border-right: 1px solid var(--line-1);
  display: flex;
  flex-direction: column;
  transition: width 140ms linear;
}
.sidebar.collapsed { width: 56px; }

.sidebar-header {
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 12px;
  border-bottom: 1px solid var(--line);
}
.sidebar-brand-mark {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.14em;
  color: var(--fg);
}
.sidebar-brand-sub {
  font-size: 9px;
  color: var(--fg-mute);
  letter-spacing: 0.12em;
}
.sidebar-collapse {
  background: transparent;
  border: 1px solid var(--line-1);
  color: var(--fg-mute);
  width: 22px;
  height: 22px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}
.sidebar-collapse:hover { color: var(--fg); border-color: var(--line-2); }
.sidebar-collapse .flip { transform: rotate(180deg); }

.sidebar-nav {
  display: flex;
  flex-direction: column;
  padding: 8px 0;
  gap: 1px;
  flex: 1;
  overflow-y: auto;
}
.sidebar-nav-btn {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px 10px 11px;
  background: transparent;
  border: 0;
  border-left: 3px solid transparent;
  color: var(--fg-mute);
  font-family: inherit;
  font-size: 10.5px;
  letter-spacing: 0.14em;
  text-align: left;
  cursor: pointer;
  white-space: nowrap;
}
.sidebar-nav-btn:hover {
  color: var(--fg-dim);
  background: var(--bg-2);
}
.sidebar-nav-btn[data-active="true"] {
  color: var(--amber);
  border-left-color: var(--amber);
  background: rgba(255, 136, 0, 0.04);
}

.sidebar-status-block {
  border-top: 1px solid var(--line);
  padding: 10px 12px 14px;
  font-size: 9.5px;
  letter-spacing: 0.1em;
  color: var(--fg-mute);
  display: grid;
  gap: 4px;
}
.sidebar-status-head {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--green);
  font-weight: 600;
  margin-bottom: 6px;
}
.sidebar-pulse {
  width: 6px;
  height: 6px;
  background: var(--green);
  box-shadow: 0 0 8px var(--green);
  animation: pulse-dot 1.6s ease-in-out infinite;
}
.sidebar-status-row { display: flex; justify-content: space-between; gap: 10px; }
.sidebar-status-row .v { color: var(--fg-dim); font-variant-numeric: tabular-nums; }

/* ========== Section shell (shared by non-WarRoom sections) ========== */
.section-shell {
  padding: 24px 28px;
  height: 100%;
  overflow-y: auto;
  display: grid;
  gap: 20px;
  align-content: start;
}
.section-header {
  display: flex;
  align-items: baseline;
  gap: 16px;
  border-bottom: 1px solid var(--line);
  padding-bottom: 12px;
}
.section-header h1 {
  font-size: 18px;
  letter-spacing: 0.2em;
  color: var(--fg);
  font-weight: 700;
}
.section-header .sub {
  color: var(--fg-mute);
  font-size: 11px;
  letter-spacing: 0.12em;
}
```

- [ ] **Step 2: Run spec verify for T0.3.3**

- [ ] **Step 3: Commit**

```bash
git add app/globals.css
git commit -m "feat: complete T0.3.3 — sidebar + shell CSS"
```

---

## Task 7: T0.4.1 — Demo data fixtures

**Files:**
- Create: `lib/demo-tabs.ts`

- [ ] **Step 1: Write the fixtures**

```ts
// lib/demo-tabs.ts
export type DemoInvestigator = {
  id: string;
  role: "history" | "dependency" | "diff" | "trace" | "runtime";
  status: "idle" | "dispatched" | "investigating" | "complete" | "failed";
  runs_total: number;
  runs_24h: number;
  avg_mtta_seconds: number;
  last_verdict: "clear" | "monitor" | "anomaly" | "critical" | null;
  last_run_iso: string;
  last_action: string;
};

export type DemoOperation = {
  id: string;
  sha: string;
  author: string;
  pushed_at: string;
  status: "active" | "clear" | "suspended" | "failed";
  verdict: "clear" | "monitor" | "anomaly" | "critical" | "pending";
  duration_seconds: number;
  threats_count: number;
  files_changed: number;
  score: number;
  hook_events: number;
};

export type DemoThreatArchiveEntry = {
  id: string;
  ts_iso: string;
  deploy_sha: string;
  severity: "low" | "medium" | "high" | "critical";
  category: "supply-chain" | "secrets" | "auth" | "perf" | "dependency" | "diff";
  description: string;
  status: "open" | "resolved";
};

export type DemoSystemHealth = {
  service: "kv" | "ai-gateway" | "discord" | "github";
  label: string;
  ok: boolean;
  latency_ms: number;
  last_error: string | null;
  extra: string;
};

export const DEMO_INVESTIGATORS: DemoInvestigator[] = [
  {
    id: "history",
    role: "history",
    status: "complete",
    runs_total: 248,
    runs_24h: 47,
    avg_mtta_seconds: 12,
    last_verdict: "clear",
    last_run_iso: "2026-05-02T18:31:04Z",
    last_action: "scanned 47 prior commits to dep-018",
  },
  {
    id: "dependency",
    role: "dependency",
    status: "investigating",
    runs_total: 211,
    runs_24h: 41,
    avg_mtta_seconds: 18,
    last_verdict: "anomaly",
    last_run_iso: "2026-05-02T18:32:11Z",
    last_action: "traced lodash@4.17.20 → 4.17.21 risk surface",
  },
  {
    id: "diff",
    role: "diff",
    status: "complete",
    runs_total: 198,
    runs_24h: 39,
    avg_mtta_seconds: 8,
    last_verdict: "monitor",
    last_run_iso: "2026-05-02T18:30:45Z",
    last_action: "diffed 14 files · flagged 2 high-risk hunks",
  },
  {
    id: "trace",
    role: "trace",
    status: "idle",
    runs_total: 87,
    runs_24h: 11,
    avg_mtta_seconds: 22,
    last_verdict: "clear",
    last_run_iso: "2026-05-02T17:14:00Z",
    last_action: "—",
  },
];

export const DEMO_OPERATIONS: DemoOperation[] = [
  { id: "dep-021", sha: "a4f2e8c", author: "dev-3",  pushed_at: "2026-05-02T18:30:00Z", status: "active",    verdict: "anomaly",  duration_seconds: 142, threats_count: 3, files_changed: 14, score: 62, hook_events: 1 },
  { id: "dep-020", sha: "3c91d20", author: "dev-1",  pushed_at: "2026-05-02T17:48:00Z", status: "clear",     verdict: "clear",    duration_seconds:  91, threats_count: 0, files_changed:  6, score:  8, hook_events: 0 },
  { id: "dep-019", sha: "f071a6b", author: "dev-7",  pushed_at: "2026-05-02T17:11:00Z", status: "suspended", verdict: "critical", duration_seconds: 218, threats_count: 5, files_changed: 23, score: 88, hook_events: 2 },
  { id: "dep-018", sha: "9b22c44", author: "dev-1",  pushed_at: "2026-05-02T16:42:00Z", status: "clear",     verdict: "monitor",  duration_seconds: 113, threats_count: 1, files_changed:  9, score: 31, hook_events: 0 },
  { id: "dep-017", sha: "7e3f018", author: "dev-2",  pushed_at: "2026-05-02T16:01:00Z", status: "clear",     verdict: "clear",    duration_seconds:  77, threats_count: 0, files_changed:  3, score:  4, hook_events: 0 },
  { id: "dep-016", sha: "2dd5e91", author: "dev-5",  pushed_at: "2026-05-02T15:18:00Z", status: "failed",    verdict: "critical", duration_seconds: 312, threats_count: 4, files_changed: 19, score: 92, hook_events: 1 },
  { id: "dep-015", sha: "11ac830", author: "dev-3",  pushed_at: "2026-05-02T14:30:00Z", status: "clear",     verdict: "clear",    duration_seconds:  88, threats_count: 0, files_changed:  4, score:  6, hook_events: 0 },
  { id: "dep-014", sha: "5cd9277", author: "dev-1",  pushed_at: "2026-05-02T13:12:00Z", status: "clear",     verdict: "monitor",  duration_seconds: 124, threats_count: 1, files_changed: 11, score: 28, hook_events: 0 },
];

export const DEMO_THREAT_ARCHIVE: DemoThreatArchiveEntry[] = [
  { id: "t-031", ts_iso: "2026-05-02T18:31:50Z", deploy_sha: "a4f2e8c", severity: "high",     category: "dependency",   description: "lodash bump to 4.17.21 — 1 known CVE in transitive dep",         status: "open" },
  { id: "t-030", ts_iso: "2026-05-02T18:31:31Z", deploy_sha: "a4f2e8c", severity: "medium",   category: "diff",         description: "auth check removed from PaymentService.charge",                  status: "open" },
  { id: "t-029", ts_iso: "2026-05-02T18:31:02Z", deploy_sha: "a4f2e8c", severity: "low",      category: "perf",         description: "synchronous redis call inside hot loop (handlers/checkout.ts)",   status: "open" },
  { id: "t-028", ts_iso: "2026-05-02T17:11:14Z", deploy_sha: "f071a6b", severity: "critical", category: "supply-chain", description: "newly published prefix-attack package detected: stripe-pay-utils", status: "resolved" },
  { id: "t-027", ts_iso: "2026-05-02T17:11:10Z", deploy_sha: "f071a6b", severity: "high",     category: "secrets",      description: "AWS access key pattern flagged in fixtures/seed.json",          status: "resolved" },
  { id: "t-026", ts_iso: "2026-05-02T17:11:02Z", deploy_sha: "f071a6b", severity: "medium",   category: "diff",         description: "rate limit bypassed via refactored middleware",                   status: "resolved" },
  { id: "t-025", ts_iso: "2026-05-02T16:42:18Z", deploy_sha: "9b22c44", severity: "low",      category: "perf",         description: "n+1 query in dashboards/loader",                                   status: "resolved" },
  { id: "t-024", ts_iso: "2026-05-02T15:18:33Z", deploy_sha: "2dd5e91", severity: "critical", category: "auth",         description: "JWT verifier disabled behind feature flag",                       status: "resolved" },
  { id: "t-023", ts_iso: "2026-05-02T15:18:21Z", deploy_sha: "2dd5e91", severity: "high",     category: "dependency",   description: "yanked release jsonwebtoken@9.1.1 still in lockfile",            status: "resolved" },
  { id: "t-022", ts_iso: "2026-05-02T15:18:09Z", deploy_sha: "2dd5e91", severity: "medium",   category: "diff",         description: "permissive CORS origin '*' in api/public",                         status: "resolved" },
  { id: "t-021", ts_iso: "2026-05-02T13:12:44Z", deploy_sha: "5cd9277", severity: "low",      category: "diff",         description: "eslint-disable on input sanitization line",                       status: "resolved" },
  { id: "t-020", ts_iso: "2026-05-02T11:01:10Z", deploy_sha: "older-1", severity: "low",      category: "perf",         description: "uncached gateway lookup on cold path",                            status: "resolved" },
];

export const DEMO_SYSTEM_HEALTH: DemoSystemHealth[] = [
  { service: "kv",         label: "VERCEL KV",   ok: true, latency_ms:  12, last_error: null, extra: "REGION: iad1" },
  { service: "ai-gateway", label: "AI GATEWAY",  ok: true, latency_ms: 184, last_error: null, extra: "MODEL: anthropic/claude-sonnet-4-6" },
  { service: "discord",    label: "DISCORD",     ok: true, latency_ms:  64, last_error: null, extra: "CHANNEL: #bridge-prod" },
  { service: "github",     label: "GITHUB",      ok: true, latency_ms:  91, last_error: null, extra: "RATE: 4972 / 5000" },
];
```

- [ ] **Step 2: Run spec verify for T0.4.1**

- [ ] **Step 3: Commit**

```bash
git add lib/demo-tabs.ts
git commit -m "feat: complete T0.4.1 — demo fixtures for 4 new tabs"
```

---

## Task 8: T1.1.1 — Agent Network section (demo mode)

**Files:**
- Modify: `app/(warroom)/sections/AgentNetwork.tsx` (replace stub)

- [ ] **Step 1: Implement section with tiles + roster table + drawer**

```tsx
// app/(warroom)/sections/AgentNetwork.tsx
"use client";

import { useState, useMemo } from "react";
import { useDashboard } from "../contexts/DashboardContext";
import { DEMO_INVESTIGATORS, type DemoInvestigator } from "@/lib/demo-tabs";

type RosterRow = {
  id: string;
  role: string;
  status: string;
  runs: number;
  avg_mtta: string;
  last_verdict: string;
  last_action: string;
};

export function buildRosterFromAgents(agents: Record<string, {
  status: string;
  finding?: { severity?: string } | null;
  lines?: Array<{ ts: string; text: string; cur?: boolean }>;
}>): RosterRow[] {
  return Object.entries(agents).map(([name, ev]) => {
    const lastLine = ev.lines && ev.lines.length > 0 ? ev.lines[ev.lines.length - 1].text : "—";
    return {
      id: name,
      role: name,
      status: ev.status,
      runs: 1,
      avg_mtta: "—",
      last_verdict: ev.finding?.severity ?? "—",
      last_action: lastLine,
    };
  });
}

function rosterFromDemo(rows: DemoInvestigator[]): RosterRow[] {
  return rows.map((r) => ({
    id: r.id,
    role: r.role,
    status: r.status,
    runs: r.runs_total,
    avg_mtta: `${r.avg_mtta_seconds}s`,
    last_verdict: r.last_verdict ?? "—",
    last_action: r.last_action,
  }));
}

export function AgentNetwork() {
  const { data } = useDashboard();
  const [selected, setSelected] = useState<RosterRow | null>(null);

  const roster = useMemo<RosterRow[]>(() => {
    if (data.mode === "demo") return rosterFromDemo(DEMO_INVESTIGATORS);
    return buildRosterFromAgents(data.agents ?? {});
  }, [data.mode, data.agents]);

  const tiles = useMemo(() => {
    const total = roster.length;
    const dispatched = roster.filter((r) => r.status === "dispatched" || r.status === "investigating").length;
    const idle = roster.filter((r) => r.status === "idle").length;
    const failed = roster.filter((r) => r.status === "failed").length;
    return { total, dispatched, idle, failed };
  }, [roster]);

  return (
    <div className="section-shell">
      <header className="section-header">
        <h1>AGENT NETWORK</h1>
        <span className="sub">DURABLE INVESTIGATOR ROSTER · {data.mode.toUpperCase()} MODE</span>
      </header>

      <div className="tile-row">
        <Tile label="TOTAL INVESTIGATORS" value={tiles.total} />
        <Tile label="DISPATCHED" value={tiles.dispatched} accent="amber" />
        <Tile label="IDLE" value={tiles.idle} />
        <Tile label="FAILED 24H" value={tiles.failed} accent={tiles.failed > 0 ? "red" : undefined} />
      </div>

      <table className="roster-table">
        <thead>
          <tr>
            <th>ID</th><th>ROLE</th><th>STATUS</th><th>RUNS</th><th>AVG MTTA</th><th>LAST VERDICT</th><th>LAST ACTION</th>
          </tr>
        </thead>
        <tbody>
          {roster.map((r) => (
            <tr key={r.id} onClick={() => setSelected(r)} data-investigator-id={r.id}>
              <td>{r.id}</td>
              <td>{r.role}</td>
              <td><span className={`status-pill status-${r.status}`}>{r.status.toUpperCase()}</span></td>
              <td className="num">{r.runs}</td>
              <td className="num">{r.avg_mtta}</td>
              <td>{String(r.last_verdict).toUpperCase()}</td>
              <td className="trunc">{r.last_action}</td>
            </tr>
          ))}
          {roster.length === 0 && (
            <tr><td colSpan={7} className="empty">NO INVESTIGATORS — waiting on first dispatch</td></tr>
          )}
        </tbody>
      </table>

      {selected && (
        <>
          <div className="drawer-overlay" onClick={() => setSelected(null)} />
          <div className="drawer" data-drawer-open="true" data-investigator-id={selected.id}>
            <div className="drawer-head">
              <span>INVESTIGATOR · {selected.id.toUpperCase()}</span>
              <button className="drawer-close" onClick={() => setSelected(null)}>✕</button>
            </div>
            <div className="drawer-body">
              <div className="kv"><span className="k">ROLE</span><span className="v">{selected.role}</span></div>
              <div className="kv"><span className="k">STATUS</span><span className="v">{selected.status}</span></div>
              <div className="kv"><span className="k">RUNS</span><span className="v">{selected.runs}</span></div>
              <div className="kv"><span className="k">AVG MTTA</span><span className="v">{selected.avg_mtta}</span></div>
              <div className="kv"><span className="k">LAST VERDICT</span><span className="v">{String(selected.last_verdict)}</span></div>
              <div className="kv full"><span className="k">LAST ACTION</span><span className="v">{selected.last_action}</span></div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Tile({ label, value, accent }: { label: string; value: number; accent?: "amber" | "red" }) {
  return (
    <div className="tile" data-accent={accent}>
      <div className="tile-label">{label}</div>
      <div className="tile-value">{value}</div>
    </div>
  );
}
```

- [ ] **Step 2: Run spec verify for T1.1.1**

- [ ] **Step 3: Commit**

```bash
git add app/\(warroom\)/sections/AgentNetwork.tsx
git commit -m "feat: complete T1.1.1 — agent network section (demo + live)"
```

---

## Task 9: T1.1.2 — (covered by Task 8)

This stage was specced as a follow-up that filled in the live-mode TODO. Task 8 already implements both demo and live modes (`buildRosterFromAgents`), so T1.1.2 is satisfied at this point.

- [ ] **Step 1: Confirm spec verify for T1.1.2 passes against the Task 8 code**

If it passes, mark T1.1.2 complete in `tasks/state.json` with the same `completed_at` as T1.1.1 (or re-stamp). No additional commit.

---

## Task 10: T1.1.3 — Tile / table / drawer CSS

**Files:**
- Modify: `app/globals.css` (append)

- [ ] **Step 1: Append the section CSS**

```css
/* ========== Section: Agent Network ========== */
.tile-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1px;
  background: var(--line);
  border: 1px solid var(--line);
}
.tile {
  background: var(--panel);
  padding: 14px 16px;
  display: grid;
  gap: 6px;
}
.tile-label {
  font-size: 10px;
  letter-spacing: 0.16em;
  color: var(--fg-mute);
  text-transform: uppercase;
}
.tile-value {
  font-size: 28px;
  font-weight: 700;
  color: var(--fg);
  font-variant-numeric: tabular-nums;
  line-height: 1;
}
.tile[data-accent="amber"] .tile-value { color: var(--amber); }
.tile[data-accent="red"]   .tile-value { color: var(--red);    text-shadow: 0 0 10px var(--red); }

.roster-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 11px;
}
.roster-table th {
  font-size: 9.5px;
  letter-spacing: 0.16em;
  color: var(--fg-mute);
  text-align: left;
  padding: 8px 10px;
  border-bottom: 1px solid var(--line);
  background: var(--bg-1);
}
.roster-table td {
  padding: 8px 10px;
  border-bottom: 1px solid var(--line);
  color: var(--fg-dim);
}
.roster-table td.num { font-variant-numeric: tabular-nums; color: var(--fg); }
.roster-table td.trunc { max-width: 320px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.roster-table tr:hover td { background: var(--bg-1); cursor: pointer; }
.roster-table tr td.empty { text-align: center; color: var(--fg-mute); padding: 24px; }

.status-pill {
  display: inline-block;
  padding: 1px 8px;
  font-size: 9px;
  letter-spacing: 0.14em;
  border: 1px solid var(--fg-faint);
  color: var(--fg-mute);
}
.status-pill.status-dispatched,
.status-pill.status-investigating { color: var(--amber); border-color: var(--amber-dim); }
.status-pill.status-complete      { color: var(--green); border-color: var(--green-dim); }
.status-pill.status-failed        { color: var(--red);   border-color: var(--red-dim); }

.drawer-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
  z-index: 60;
  animation: fade-in 140ms linear;
}
.drawer {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  width: 380px;
  background: var(--bg-1);
  border-left: 1px solid var(--line-2);
  z-index: 70;
  display: flex;
  flex-direction: column;
  animation: slide-in-right 220ms cubic-bezier(0.2, 0.9, 0.3, 1.05);
}
@keyframes slide-in-right {
  0% { transform: translateX(20px); opacity: 0; }
  100% { transform: translateX(0); opacity: 1; }
}
@keyframes fade-in {
  0% { opacity: 0; }
  100% { opacity: 1; }
}
.drawer-head {
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 14px;
  border-bottom: 1px solid var(--line);
  font-size: 10px;
  letter-spacing: 0.16em;
  color: var(--fg-dim);
  background: var(--bg-2);
}
.drawer-close {
  background: transparent;
  border: 0;
  color: var(--fg-mute);
  cursor: pointer;
  font-family: inherit;
  font-size: 14px;
}
.drawer-close:hover { color: var(--fg); }
.drawer-body {
  padding: 16px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
  overflow-y: auto;
}
.drawer-body .kv { display: grid; gap: 4px; }
.drawer-body .kv.full { grid-column: 1 / -1; }
.drawer-body .k { font-size: 9px; letter-spacing: 0.16em; color: var(--fg-mute); }
.drawer-body .v { font-size: 12px; color: var(--fg); }
```

- [ ] **Step 2: Run spec verify for T1.1.3**

- [ ] **Step 3: Commit**

```bash
git add app/globals.css
git commit -m "feat: complete T1.1.3 — tile/table/drawer CSS for agent network"
```

---

## Task 11: T2.1.1 — Operations section

**Files:**
- Modify: `app/(warroom)/sections/Operations.tsx` (replace stub)

- [ ] **Step 1: Implement the section + filterOperations helper**

```tsx
// app/(warroom)/sections/Operations.tsx
"use client";

import { useMemo, useState } from "react";
import { useDashboard, type DashboardTab } from "../contexts/DashboardContext";
import { DEMO_OPERATIONS, type DemoOperation } from "@/lib/demo-tabs";

const FILTERS = ["all", "active", "clear", "suspended", "failed"] as const;
type Filter = (typeof FILTERS)[number];

type OpsCardData = {
  id: string;
  sha: string;
  author: string;
  pushed_at: string;
  status: string;
  verdict: string;
  duration_seconds: number | null;
  threats_count: number | null;
  files_changed: number;
  score: number;
  hook_events: number | null;
};

export function filterOperations<T extends { verdict: string }>(ops: T[], f: string): T[] {
  if (f === "all") return ops;
  if (f === "active") return ops.filter((o) => o.verdict === "pending" || o.verdict === "monitor" || o.verdict === "anomaly");
  if (f === "clear") return ops.filter((o) => o.verdict === "clear");
  if (f === "suspended") return ops.filter((o) => o.verdict === "critical");
  if (f === "failed") return ops.filter((o) => (o as unknown as { status?: string }).status === "failed");
  return ops;
}

function fromDemo(rows: DemoOperation[]): OpsCardData[] {
  return rows.map((r) => ({
    id: r.id,
    sha: r.sha,
    author: r.author,
    pushed_at: r.pushed_at,
    status: r.status,
    verdict: r.verdict,
    duration_seconds: r.duration_seconds,
    threats_count: r.threats_count,
    files_changed: r.files_changed,
    score: r.score,
    hook_events: r.hook_events,
  }));
}

export function Operations() {
  const { data, setCurrentTab } = useDashboard();
  const [filter, setFilter] = useState<Filter>("all");

  const cards = useMemo<OpsCardData[]>(() => {
    if (data.mode === "demo") return fromDemo(DEMO_OPERATIONS);
    return (data.deploys ?? []).map((d) => {
      const verdict = data.verdict && (data.verdict as { deploy_id?: string }).deploy_id === d.id
        ? ((data.verdict as { level?: string }).level ?? "pending")
        : "pending";
      return {
        id: d.id,
        sha: d.sha,
        author: d.author,
        pushed_at: d.pushed_at,
        status: verdict === "clear" ? "clear" : verdict === "critical" ? "suspended" : "active",
        verdict,
        duration_seconds: null,
        threats_count: null,
        files_changed: d.files_changed,
        score: d.score,
        hook_events: null,
      };
    });
  }, [data.mode, data.deploys, data.verdict]);

  const filtered = filterOperations(cards, filter);

  return (
    <div className="section-shell">
      <header className="section-header">
        <h1>OPERATIONS</h1>
        <span className="sub">DEPLOY ARCHIVE · {data.mode.toUpperCase()} MODE · {filtered.length} of {cards.length}</span>
      </header>

      <div className="ops-filter-row">
        {FILTERS.map((f) => (
          <button
            key={f}
            className="filter-pill"
            data-active={filter === f ? "true" : "false"}
            onClick={() => setFilter(f)}
          >
            {f.toUpperCase()}
          </button>
        ))}
      </div>

      <div className="ops-grid">
        {filtered.map((c) => (
          <button
            key={c.id}
            type="button"
            className="ops-card"
            data-deploy-id={c.id}
            data-verdict={c.verdict}
            onClick={() => {
              data.setActiveDeploy?.(c.id as never);
              setCurrentTab("warroom" as DashboardTab);
            }}
          >
            <div className="ops-card-head">
              <span className="sha">{c.sha}</span>
              <span className="author">{c.author}</span>
              <span className={`verdict-pill data-${c.verdict}`}>{c.verdict.toUpperCase()}</span>
            </div>
            <div className="ops-card-meta">
              <span>FILES <b>{c.files_changed}</b></span>
              <span>SCORE <b>{c.score}</b></span>
              {c.threats_count !== null && <span>THREATS <b>{c.threats_count}</b></span>}
              {c.duration_seconds !== null && <span>DUR <b>{c.duration_seconds}s</b></span>}
              {c.hook_events !== null && c.hook_events > 0 && <span className="hook">HOOK <b>{c.hook_events}</b></span>}
            </div>
            <div className="ops-card-id">{c.id}</div>
          </button>
        ))}
        {filtered.length === 0 && (
          <div className="ops-empty">NO DEPLOYS MATCH FILTER</div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Run spec verify for T2.1.1**

- [ ] **Step 3: Commit**

```bash
git add app/\(warroom\)/sections/Operations.tsx
git commit -m "feat: complete T2.1.1 — operations section (demo + live)"
```

---

## Task 12: T2.1.2 — Operations card CSS

**Files:**
- Modify: `app/globals.css` (append)

- [ ] **Step 1: Append the operations CSS**

```css
/* ========== Section: Operations ========== */
.ops-filter-row {
  display: flex;
  gap: 6px;
}
.filter-pill {
  background: transparent;
  border: 1px solid var(--line-2);
  color: var(--fg-mute);
  font-family: inherit;
  font-size: 9.5px;
  letter-spacing: 0.16em;
  padding: 6px 12px;
  cursor: pointer;
  text-transform: uppercase;
}
.filter-pill:hover { color: var(--fg-dim); border-color: var(--fg-mute); }
.filter-pill[data-active="true"] {
  border-color: var(--amber);
  color: var(--amber);
  background: rgba(255, 136, 0, 0.04);
}

.ops-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 1px;
  background: var(--line);
  border: 1px solid var(--line);
}
.ops-card {
  background: var(--panel);
  border: 0;
  padding: 14px 16px;
  text-align: left;
  font-family: inherit;
  cursor: pointer;
  display: grid;
  gap: 8px;
  color: var(--fg-dim);
}
.ops-card:hover { background: var(--bg-1); outline: 1px solid var(--amber); outline-offset: -1px; }
.ops-card-head {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 11px;
}
.ops-card-head .sha {
  color: var(--amber);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
.ops-card-head .author { color: var(--fg-dim); }
.verdict-pill {
  margin-left: auto;
  padding: 1px 7px;
  font-size: 9px;
  letter-spacing: 0.14em;
  border: 1px solid var(--fg-faint);
  color: var(--fg-mute);
}
.verdict-pill.data-clear     { color: var(--green);  border-color: var(--green-dim); }
.verdict-pill.data-monitor   { color: var(--amber);  border-color: var(--amber-dim); }
.verdict-pill.data-anomaly   { color: var(--orange); border-color: var(--amber-dim); }
.verdict-pill.data-critical  { color: var(--red);    border-color: var(--red-dim);  text-shadow: 0 0 8px var(--red); }
.verdict-pill.data-pending   { color: var(--fg-mute); border-color: var(--fg-faint); }

.ops-card-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
  font-size: 10px;
  letter-spacing: 0.1em;
  color: var(--fg-mute);
}
.ops-card-meta b { color: var(--fg); font-weight: 500; font-variant-numeric: tabular-nums; }
.ops-card-meta .hook b { color: var(--amber); }

.ops-card-id {
  font-size: 9px;
  letter-spacing: 0.18em;
  color: var(--fg-faint);
}

.ops-empty {
  grid-column: 1 / -1;
  background: var(--panel);
  text-align: center;
  padding: 32px;
  color: var(--fg-mute);
  font-size: 11px;
  letter-spacing: 0.16em;
}
```

- [ ] **Step 2: Run spec verify for T2.1.2**

- [ ] **Step 3: Commit**

```bash
git add app/globals.css
git commit -m "feat: complete T2.1.2 — operations card CSS"
```

---

## Task 13: T3.0.1 — Pass through `kind` in feed mapping

**Files:**
- Modify: `lib/sse-events.ts`
- Modify: `app/(warroom)/hooks/useDeploysSSE.ts`

- [ ] **Step 1: Extend FeedEvent kind union**

Open `lib/sse-events.ts`, find the `FeedEvent` type, and broaden `kind`:

```ts
// inside FeedEvent definition
kind: "sys" | "hook" | "deploy" | "agent" | "verdict";
```

If the type is currently a string literal limited to `"sys"`, swap to the union above. Update `parseSSEEvent` only if it currently rejects unknown kinds.

- [ ] **Step 2: Pass `kind` through in the live-mode mapping**

In `app/(warroom)/hooks/useDeploysSSE.ts` around lines 195-200:

```ts
// before:
//   feed: liveState.feed.map((f) => ({
//     ts: f.ts,
//     severity: f.severity,
//     kind: "sys" as const,
//     message: f.message,
//   })),

// after:
feed: liveState.feed.map((f) => ({
  ts: f.ts,
  severity: f.severity,
  kind: f.kind ?? "sys",
  message: f.message,
})),
```

- [ ] **Step 3: Run spec verify for T3.0.1**

- [ ] **Step 4: Commit**

```bash
git add lib/sse-events.ts app/\(warroom\)/hooks/useDeploysSSE.ts
git commit -m "feat: complete T3.0.1 — pass kind through feed mapping"
```

---

## Task 14: T3.1.1 — Intelligence section

**Files:**
- Modify: `app/(warroom)/sections/Intelligence.tsx` (replace stub)

- [ ] **Step 1: Implement the section + bucketThreats helper**

```tsx
// app/(warroom)/sections/Intelligence.tsx
"use client";

import { useMemo } from "react";
import { useDashboard } from "../contexts/DashboardContext";
import { DEMO_THREAT_ARCHIVE, type DemoThreatArchiveEntry } from "@/lib/demo-tabs";

type Severity = "low" | "medium" | "high" | "critical";
type Bucket = { ts_start: number; low: number; medium: number; high: number; critical: number };

export function bucketThreats(
  entries: Array<{ ts: number; severity: string }>,
  start: number,
  end: number,
  count: number,
): Bucket[] {
  const span = (end - start) / count;
  const buckets: Bucket[] = Array.from({ length: count }, (_, i) => ({
    ts_start: start + i * span,
    low: 0,
    medium: 0,
    high: 0,
    critical: 0,
  }));
  for (const e of entries) {
    let idx = Math.floor((e.ts - start) / span);
    if (idx < 0) continue;
    if (idx >= count) idx = count - 1;
    const sev = e.severity as Severity;
    if (sev in buckets[idx]) (buckets[idx] as unknown as Record<Severity, number>)[sev]++;
  }
  return buckets;
}

function asTs(iso: string): number {
  return new Date(iso).getTime();
}

export function Intelligence() {
  const { data } = useDashboard();

  const archive: DemoThreatArchiveEntry[] = useMemo(() => {
    if (data.mode === "demo") return DEMO_THREAT_ARCHIVE;
    return (data.threats ?? []).map((t) => ({
      id: t.id,
      ts_iso: new Date(Date.now() - (t.age_seconds ?? 0) * 1000).toISOString(),
      deploy_sha: "—",
      severity: (t.severity as Severity) ?? "low",
      category: "diff",
      description: t.description,
      status: t.status,
    }));
  }, [data.mode, data.threats]);

  const buckets = useMemo(() => {
    if (archive.length === 0) return [];
    const tsList = archive.map((a) => asTs(a.ts_iso));
    const start = Math.min(...tsList);
    const end = Math.max(...tsList) + 1;
    return bucketThreats(
      archive.map((a) => ({ ts: asTs(a.ts_iso), severity: a.severity })),
      start,
      end,
      12,
    );
  }, [archive]);

  const hookEvents = useMemo(() => {
    return (data.feed ?? []).filter((f) => f.kind === "hook").slice(-20).reverse();
  }, [data.feed]);

  return (
    <div className="section-shell intel-shell">
      <header className="section-header">
        <h1>INTELLIGENCE</h1>
        <span className="sub">THREAT ARCHIVE · HOOK AUDIT · {data.mode.toUpperCase()} MODE</span>
      </header>

      <div className="intel-grid">
        <section className="intel-heatmap">
          <div className="intel-panel-head">SEVERITY HEATMAP · 12 BUCKETS</div>
          <div className="intel-heatmap-body">
            <div className="intel-heatmap-rows">
              {(["critical", "high", "medium", "low"] as Severity[]).map((sev) => (
                <div key={sev} className="intel-heatmap-row" data-sev={sev}>
                  <div className="row-label">{sev.toUpperCase()}</div>
                  <div className="row-cells">
                    {buckets.map((b, i) => {
                      const v = (b as unknown as Record<Severity, number>)[sev];
                      return (
                        <div
                          key={i}
                          className={`heatmap-cell ${v > 0 ? "filled" : ""}`}
                          data-count={v}
                          title={`${v} ${sev}`}
                        />
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="intel-archive">
          <div className="intel-panel-head">
            THREAT ARCHIVE
            {data.mode === "live" && <span className="live-note">CURRENT SESSION — historical archive coming soon</span>}
          </div>
          <table className="intel-archive-table">
            <thead>
              <tr><th>TIME</th><th>ID</th><th>SEV</th><th>DESCRIPTION</th><th>STATUS</th></tr>
            </thead>
            <tbody>
              {archive.map((t) => (
                <tr key={t.id} data-sev={t.severity}>
                  <td className="num">{new Date(t.ts_iso).toLocaleTimeString("en-GB", { hour12: false })}</td>
                  <td>{t.id}</td>
                  <td><span className={`sev-badge sev-${t.severity}`}>{t.severity.toUpperCase()}</span></td>
                  <td className="trunc">{t.description}</td>
                  <td>{t.status.toUpperCase()}</td>
                </tr>
              ))}
              {archive.length === 0 && (
                <tr><td colSpan={5} className="empty">NO THREATS CAPTURED</td></tr>
              )}
            </tbody>
          </table>
        </section>
      </div>

      <section className="intel-audit">
        <div className="intel-panel-head">HOOK AUDIT · LATEST 20</div>
        <div className="intel-audit-body">
          {hookEvents.length === 0 && <div className="empty">NO HOOK EVENTS</div>}
          {hookEvents.map((f, i) => (
            <div key={i} className="feed-line" data-sev={f.severity}>
              <span className="ts">{f.ts}</span>
              <span className="marker">⚙</span>
              <span className="msg">{f.message}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Run spec verify for T3.1.1**

- [ ] **Step 3: Commit**

```bash
git add app/\(warroom\)/sections/Intelligence.tsx
git commit -m "feat: complete T3.1.1 — intelligence section"
```

---

## Task 15: T3.1.2 — Intelligence layout CSS

**Files:**
- Modify: `app/globals.css` (append)

- [ ] **Step 1: Append the intelligence CSS**

```css
/* ========== Section: Intelligence ========== */
.intel-shell .intel-grid {
  display: grid;
  grid-template-columns: 1fr 1.4fr;
  gap: 12px;
  min-height: 0;
}
.intel-panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 8px 12px;
  font-size: 9.5px;
  letter-spacing: 0.16em;
  color: var(--fg-dim);
  background: var(--bg-1);
  border-bottom: 1px solid var(--line);
}
.intel-panel-head .live-note {
  font-size: 9px;
  letter-spacing: 0.12em;
  color: var(--amber);
  text-transform: none;
}

.intel-heatmap, .intel-archive, .intel-audit {
  background: var(--panel);
  border: 1px solid var(--line);
}
.intel-heatmap-body { padding: 12px; }
.intel-heatmap-rows { display: grid; gap: 6px; }
.intel-heatmap-row {
  display: grid;
  grid-template-columns: 80px 1fr;
  gap: 8px;
  align-items: center;
}
.intel-heatmap-row .row-label {
  font-size: 9px;
  letter-spacing: 0.14em;
  color: var(--fg-mute);
}
.intel-heatmap-row[data-sev="critical"] .row-label { color: var(--red); }
.intel-heatmap-row[data-sev="high"]     .row-label { color: var(--orange); }
.intel-heatmap-row[data-sev="medium"]   .row-label { color: var(--amber); }
.intel-heatmap-row[data-sev="low"]      .row-label { color: var(--green); }
.intel-heatmap-row .row-cells {
  display: grid;
  grid-template-columns: repeat(12, 1fr);
  gap: 3px;
  height: 22px;
}
.intel-heatmap-row .heatmap-cell {
  background: var(--bg-2);
  border: 1px solid var(--line);
  height: 100%;
}
.intel-heatmap-row[data-sev="critical"] .heatmap-cell.filled {
  background: rgba(255, 51, 68, 0.5); border-color: var(--red); box-shadow: 0 0 6px var(--red);
}
.intel-heatmap-row[data-sev="high"] .heatmap-cell.filled {
  background: rgba(255, 90, 31, 0.45); border-color: var(--orange);
}
.intel-heatmap-row[data-sev="medium"] .heatmap-cell.filled {
  background: rgba(255, 136, 0, 0.4); border-color: var(--amber);
}
.intel-heatmap-row[data-sev="low"] .heatmap-cell.filled {
  background: rgba(0, 255, 136, 0.32); border-color: var(--green-dim);
}

.intel-archive-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 11px;
}
.intel-archive-table th,
.intel-archive-table td {
  text-align: left;
  padding: 6px 10px;
  border-bottom: 1px solid var(--line);
  color: var(--fg-dim);
}
.intel-archive-table th {
  font-size: 9px;
  letter-spacing: 0.16em;
  color: var(--fg-mute);
  background: var(--bg-1);
}
.intel-archive-table td.num { font-variant-numeric: tabular-nums; }
.intel-archive-table td.trunc { max-width: 380px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.intel-archive-table td.empty { text-align: center; color: var(--fg-mute); padding: 18px; }

.sev-badge {
  display: inline-block;
  padding: 1px 6px;
  font-size: 9px;
  letter-spacing: 0.12em;
  border: 1px solid var(--fg-faint);
  color: var(--fg-mute);
}
.sev-badge.sev-critical { color: var(--red);    border-color: var(--red-dim); }
.sev-badge.sev-high     { color: var(--orange); border-color: var(--amber-dim); }
.sev-badge.sev-medium   { color: var(--amber);  border-color: var(--amber-dim); }
.sev-badge.sev-low      { color: var(--green);  border-color: var(--green-dim); }

.intel-audit-body {
  max-height: 200px;
  overflow-y: auto;
}
.intel-audit-body .empty {
  text-align: center;
  color: var(--fg-mute);
  padding: 18px;
  font-size: 11px;
  letter-spacing: 0.14em;
}
```

- [ ] **Step 2: Run spec verify for T3.1.2**

- [ ] **Step 3: Commit**

```bash
git add app/globals.css
git commit -m "feat: complete T3.1.2 — intelligence layout CSS"
```

---

## Task 16: T4.1.1 — `/api/health` endpoint

**Files:**
- Create: `app/api/health/route.ts`

- [ ] **Step 1: Implement the parallel pings**

```ts
// app/api/health/route.ts
import { NextResponse } from "next/server";

type ServiceResult = {
  name: "kv" | "ai-gateway" | "discord" | "github";
  ok: boolean;
  latency_ms: number | null;
  last_error: string | null;
  extra?: string | null;
};

const TIMEOUT_MS = 3000;

async function timed<T>(fn: () => Promise<T>): Promise<{ ok: boolean; latency_ms: number; value?: T; error?: string }> {
  const start = Date.now();
  try {
    const value = await fn();
    return { ok: true, latency_ms: Date.now() - start, value };
  } catch (e) {
    return { ok: false, latency_ms: Date.now() - start, error: e instanceof Error ? e.message : String(e) };
  }
}

function withTimeout<T>(p: Promise<T>, label: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, rej) => setTimeout(() => rej(new Error(`${label} timeout`)), TIMEOUT_MS)),
  ]);
}

async function pingKV(): Promise<ServiceResult> {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) {
    return { name: "kv", ok: false, latency_ms: null, last_error: "env-not-configured" };
  }
  const r = await timed(() => withTimeout(
    fetch(`${url}/ping`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }),
    "kv",
  ));
  return {
    name: "kv",
    ok: r.ok && (r.value as Response).ok,
    latency_ms: r.latency_ms,
    last_error: r.error ?? (r.value && !(r.value as Response).ok ? `kv ${(r.value as Response).status}` : null),
    extra: process.env.KV_URL ? new URL(process.env.KV_URL).hostname : null,
  };
}

async function pingAIGateway(): Promise<ServiceResult> {
  const key = process.env.AI_GATEWAY_API_KEY;
  if (!key) return { name: "ai-gateway", ok: false, latency_ms: null, last_error: "env-not-configured" };
  const r = await timed(() => withTimeout(
    fetch("https://gateway.ai.vercel.app/v1/models", {
      headers: { Authorization: `Bearer ${key}` },
      cache: "no-store",
    }),
    "ai-gateway",
  ));
  return {
    name: "ai-gateway",
    ok: r.ok && (r.value as Response).ok,
    latency_ms: r.latency_ms,
    last_error: r.error ?? (r.value && !(r.value as Response).ok ? `gateway ${(r.value as Response).status}` : null),
    extra: "anthropic/claude-sonnet-4-6",
  };
}

async function pingDiscord(): Promise<ServiceResult> {
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) return { name: "discord", ok: false, latency_ms: null, last_error: "env-not-configured" };
  const r = await timed(() => withTimeout(
    fetch("https://discord.com/api/v10/users/@me", {
      headers: { Authorization: `Bot ${token}` },
      cache: "no-store",
    }),
    "discord",
  ));
  return {
    name: "discord",
    ok: r.ok && (r.value as Response).ok,
    latency_ms: r.latency_ms,
    last_error: r.error ?? (r.value && !(r.value as Response).ok ? `discord ${(r.value as Response).status}` : null),
    extra: process.env.DISCORD_CHANNEL_ID ? `channel:${process.env.DISCORD_CHANNEL_ID}` : null,
  };
}

async function pingGitHub(): Promise<ServiceResult> {
  const token = process.env.GITHUB_TOKEN;
  if (!token) return { name: "github", ok: false, latency_ms: null, last_error: "env-not-configured" };
  const r = await timed(() => withTimeout(
    fetch("https://api.github.com/rate_limit", {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" },
      cache: "no-store",
    }),
    "github",
  ));
  let extra: string | null = null;
  if (r.ok && (r.value as Response).ok) {
    try {
      const json = await (r.value as Response).clone().json();
      extra = `rate ${json.rate.remaining}/${json.rate.limit}`;
    } catch {
      // ignore
    }
  }
  return {
    name: "github",
    ok: r.ok && (r.value as Response).ok,
    latency_ms: r.latency_ms,
    last_error: r.error ?? (r.value && !(r.value as Response).ok ? `github ${(r.value as Response).status}` : null),
    extra,
  };
}

export async function GET(_req: Request) {
  const services = await Promise.all([pingKV(), pingAIGateway(), pingDiscord(), pingGitHub()]);
  return NextResponse.json(
    { services },
    { headers: { "Cache-Control": "no-store" } },
  );
}
```

- [ ] **Step 2: Run spec verify for T4.1.1**

- [ ] **Step 3: Commit**

```bash
git add app/api/health/route.ts
git commit -m "feat: complete T4.1.1 — /api/health endpoint with parallel pings"
```

---

## Task 17: T4.1.2 — Systems section

**Files:**
- Modify: `app/(warroom)/sections/Systems.tsx` (replace stub)

- [ ] **Step 1: Implement section + classifyLatency helper + polling**

```tsx
// app/(warroom)/sections/Systems.tsx
"use client";

import { useEffect, useState, useMemo } from "react";
import { useDashboard } from "../contexts/DashboardContext";
import { DEMO_SYSTEM_HEALTH, type DemoSystemHealth } from "@/lib/demo-tabs";

type LatencyClass = "ok" | "slow" | "fail";

export function classifyLatency(latency: number | null | undefined): LatencyClass {
  if (latency == null) return "fail";
  if (latency > 1500) return "slow";
  return "ok";
}

type HealthResp = { services: Array<{ name: string; ok: boolean; latency_ms: number | null; last_error: string | null; extra?: string | null }> };

export function Systems() {
  const { data } = useDashboard();
  const [live, setLive] = useState<HealthResp | null>(null);

  useEffect(() => {
    if (data.mode !== "live") return;
    let abort = false;
    const fetchOnce = async () => {
      try {
        const r = await fetch("/api/health", { cache: "no-store" });
        if (!r.ok) return;
        const json = (await r.json()) as HealthResp;
        if (!abort) setLive(json);
      } catch {
        // swallow — next interval will retry
      }
    };
    fetchOnce();
    const id = setInterval(fetchOnce, 10_000);
    return () => {
      abort = true;
      clearInterval(id);
    };
  }, [data.mode]);

  const tiles: DemoSystemHealth[] = useMemo(() => {
    if (data.mode === "demo" || !live) return DEMO_SYSTEM_HEALTH;
    const labelMap: Record<string, string> = {
      "kv": "VERCEL KV",
      "ai-gateway": "AI GATEWAY",
      "discord": "DISCORD",
      "github": "GITHUB",
    };
    return live.services.map((s) => ({
      service: s.name as DemoSystemHealth["service"],
      label: labelMap[s.name] ?? s.name.toUpperCase(),
      ok: s.ok,
      latency_ms: s.latency_ms ?? 0,
      last_error: s.last_error,
      extra: s.extra ?? "",
    }));
  }, [data.mode, live]);

  const recentErrors = useMemo(
    () => (data.feed ?? []).filter((f) => f.severity === "critical" || f.severity === "warn").slice(-10).reverse(),
    [data.feed],
  );

  const burnPct = data.budgetPct ?? 100;
  const burnClass = burnPct < 10 ? "red" : burnPct < 30 ? "amber" : "green";

  return (
    <div className="section-shell">
      <header className="section-header">
        <h1>SYSTEMS</h1>
        <span className="sub">PLATFORM HEALTH · {data.mode.toUpperCase()} MODE</span>
      </header>

      <div className="systems-grid">
        {tiles.map((t) => {
          const cls = classifyLatency(t.ok ? t.latency_ms : null);
          return (
            <div key={t.service} className="service-tile" data-status={cls}>
              <div className="service-tile-head">
                <span className="dot" />
                <span className="label">{t.label}</span>
              </div>
              <div className="service-tile-latency">{t.ok ? `${Math.round(t.latency_ms)} ms` : "—"}</div>
              <div className="service-tile-extra">{t.extra}</div>
              {!t.ok && t.last_error && <div className="service-tile-error">{t.last_error}</div>}
            </div>
          );
        })}
      </div>

      <div className="systems-secondary">
        <div className="budget-ring-wrap" data-burn={burnClass}>
          <div className="budget-label">AI BUDGET REMAINING</div>
          <BudgetRing pct={burnPct} burnClass={burnClass} />
          <div className="budget-pct">{Math.round(burnPct)}%</div>
        </div>

        <div className="recent-errors">
          <div className="intel-panel-head">RECENT ERRORS · LATEST 10</div>
          <div className="recent-errors-body">
            {recentErrors.length === 0 && <div className="empty">NO RECENT ERRORS</div>}
            {recentErrors.map((f, i) => (
              <div key={i} className="feed-line" data-sev={f.severity}>
                <span className="ts">{f.ts}</span>
                <span className="marker">!</span>
                <span className="msg">{f.message}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function BudgetRing({ pct, burnClass }: { pct: number; burnClass: "green" | "amber" | "red" }) {
  const pctClamped = Math.max(0, Math.min(100, pct));
  const r = 38;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - pctClamped / 100);
  const stroke = burnClass === "red" ? "var(--red)" : burnClass === "amber" ? "var(--amber)" : "var(--green)";
  return (
    <svg width="92" height="92" viewBox="0 0 92 92" className="budget-ring">
      <circle cx="46" cy="46" r={r} stroke="var(--line-1)" strokeWidth="6" fill="none" />
      <circle
        cx="46"
        cy="46"
        r={r}
        stroke={stroke}
        strokeWidth="6"
        fill="none"
        strokeDasharray={c}
        strokeDashoffset={offset}
        transform="rotate(-90 46 46)"
      />
    </svg>
  );
}
```

- [ ] **Step 2: Run spec verify for T4.1.2**

- [ ] **Step 3: Commit**

```bash
git add app/\(warroom\)/sections/Systems.tsx
git commit -m "feat: complete T4.1.2 — systems section with health polling"
```

---

## Task 18: T4.1.3 — Systems CSS

**Files:**
- Modify: `app/globals.css` (append)

- [ ] **Step 1: Append the systems CSS**

```css
/* ========== Section: Systems ========== */
.systems-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 1px;
  background: var(--line);
  border: 1px solid var(--line);
}
.service-tile {
  background: var(--panel);
  padding: 14px 16px;
  display: grid;
  gap: 6px;
  position: relative;
}
.service-tile .dot {
  width: 8px; height: 8px;
  background: var(--green);
  box-shadow: 0 0 6px var(--green);
}
.service-tile[data-status="slow"] .dot { background: var(--amber); box-shadow: 0 0 6px var(--amber); }
.service-tile[data-status="fail"] .dot { background: var(--red);   box-shadow: 0 0 8px var(--red); animation: pulse-dot 0.8s ease-in-out infinite; }
.service-tile-head {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 10px;
  letter-spacing: 0.16em;
  color: var(--fg-dim);
}
.service-tile-latency {
  font-size: 22px;
  font-weight: 700;
  color: var(--fg);
  font-variant-numeric: tabular-nums;
}
.service-tile-extra {
  font-size: 9.5px;
  color: var(--fg-mute);
  letter-spacing: 0.1em;
}
.service-tile-error {
  font-size: 10px;
  color: var(--red);
  letter-spacing: 0.06em;
}

.systems-secondary {
  display: grid;
  grid-template-columns: 220px 1fr;
  gap: 12px;
}
.budget-ring-wrap {
  background: var(--panel);
  border: 1px solid var(--line);
  padding: 16px;
  display: grid;
  justify-items: center;
  gap: 8px;
  position: relative;
}
.budget-label {
  font-size: 9px;
  letter-spacing: 0.18em;
  color: var(--fg-mute);
}
.budget-ring { display: block; }
.budget-pct {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 16px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
.budget-ring-wrap[data-burn="red"]   .budget-pct { color: var(--red); }
.budget-ring-wrap[data-burn="amber"] .budget-pct { color: var(--amber); }
.budget-ring-wrap[data-burn="green"] .budget-pct { color: var(--green); }

.recent-errors {
  background: var(--panel);
  border: 1px solid var(--line);
}
.recent-errors-body { padding: 4px 0; max-height: 200px; overflow-y: auto; }
.recent-errors-body .empty {
  text-align: center;
  color: var(--fg-mute);
  padding: 18px;
  font-size: 11px;
  letter-spacing: 0.14em;
}
```

- [ ] **Step 2: Run spec verify for T4.1.3**

- [ ] **Step 3: Commit**

```bash
git add app/globals.css
git commit -m "feat: complete T4.1.3 — systems CSS"
```

---

## Task 19: T5.1.1 — Demo/Live toggle parity

**Files:**
- Modify (only if drift found): any of the 5 section files

- [ ] **Step 1: Sweep for direct `useDeploysSSE` calls inside sections**

Run:

```bash
grep -nE "useDeploysSSE\\s*\\(" app/\\(warroom\\)/sections/*.tsx
```

Expected: empty. If a section directly calls the hook, switch it to `useDashboard`.

- [ ] **Step 2: Run spec verify for T5.1.1**

- [ ] **Step 3: Commit (only if changes were necessary)**

```bash
git add app/\(warroom\)/sections/
git commit -m "fix: complete T5.1.1 — sections use useDashboard, not useDeploysSSE directly"
```

If no changes: mark stage complete in `tasks/state.json` without commit.

---

## Task 20: T5.1.2 — SSE persistence across tab switches

**Files:** none (verification stage)

- [ ] **Step 1: Confirm only one `<DashboardProvider>` mount**

```bash
grep -c '<DashboardProvider' app/\(warroom\)/page.tsx
```

Expected output: `1`.

- [ ] **Step 2: Run spec verify for T5.1.2**

- [ ] **Step 3: Mark stage complete in `tasks/state.json` (no code changes)**

---

## Task 21: T5.1.3 — Aesthetic audit

**Files:** none (verification stage)

- [ ] **Step 1: Run the spec's tier3 grep**

This is the load-bearing audit — runs `node` over all section/sidebar/context TSX files plus the new CSS blocks, asserting no shadcn imports, no `bg-orange-*`, no `rounded-*`, no `backdrop-blur`, no `linear-gradient`, no `border-radius > 0` in new CSS.

- [ ] **Step 2: Fix any violations the audit reports, then re-run**

- [ ] **Step 3: Run spec verify for T5.1.3**

- [ ] **Step 4: Mark stage complete in `tasks/state.json`. Commit only if violations were fixed.**

```bash
git add -A
git commit -m "chore: complete T5.1.3 — aesthetic audit cleanups"
```

---

## Task 22: T6.1.1 — Install Playwright + init

**Files:**
- Modify: `package.json` — add `@playwright/test` devDep + `test:e2e` script
- Create: `playwright.config.ts`

- [ ] **Step 1: Install + chromium**

```bash
npm install --save-dev @playwright/test
npx playwright install chromium
```

- [ ] **Step 2: Add the test script to `package.json`**

In `package.json` `"scripts"`:

```json
"test:e2e": "playwright test"
```

- [ ] **Step 3: Write `playwright.config.ts`**

```ts
// playwright.config.ts
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3030",
    trace: "on-first-retry",
  },
  webServer: {
    command: "npx next dev -p 3030",
    url: "http://localhost:3030",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
});
```

- [ ] **Step 4: Run spec verify for T6.1.1**

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json playwright.config.ts
git commit -m "feat: complete T6.1.1 — install Playwright + base config"
```

---

## Task 23: T6.1.2 — `tests/e2e/sidebar-nav.spec.ts`

**Files:**
- Create: `tests/e2e/sidebar-nav.spec.ts`

- [ ] **Step 1: Write the spec**

```ts
// tests/e2e/sidebar-nav.spec.ts
import { test, expect } from "@playwright/test";

const TABS: Array<{ id: "warroom" | "agents" | "ops" | "intel" | "systems"; label: string; marker: RegExp }> = [
  { id: "warroom", label: "WAR ROOM",       marker: /BRIDGE/ },
  { id: "agents",  label: "AGENT NETWORK",  marker: /INVESTIGATOR/i },
  { id: "ops",     label: "OPERATIONS",     marker: /OPERATIONS/ },
  { id: "intel",   label: "INTELLIGENCE",   marker: /INTELLIGENCE/ },
  { id: "systems", label: "SYSTEMS",        marker: /KV/ },
];

test("sidebar nav switches tabs and updates URL", async ({ page }) => {
  await page.goto("/");
  for (const t of TABS) {
    await page.locator(`[data-tab="${t.id}"]`).click();
    await expect(page.locator(`[data-tab="${t.id}"][data-active="true"]`)).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`tab=${t.id}`));
    await expect(page.locator("body")).toContainText(t.marker);
  }
});
```

- [ ] **Step 2: Run spec verify for T6.1.2**

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/sidebar-nav.spec.ts
git commit -m "feat: complete T6.1.2 — playwright sidebar nav test"
```

---

## Task 24: T6.1.3 — `tests/e2e/sse-persistence.spec.ts`

**Files:**
- Create: `tests/e2e/sse-persistence.spec.ts`

- [ ] **Step 1: Write the spec**

```ts
// tests/e2e/sse-persistence.spec.ts
import { test, expect } from "@playwright/test";

test("deploysAnalyzed counter does not reset across tab switches", async ({ page }) => {
  await page.goto("/?live=0"); // demo mode
  // Wait for sidebar status block to render
  await expect(page.locator(".sidebar-status-block")).toBeVisible();

  // Wait until at least 1 deploy is analyzed (demo timer takes a moment)
  await expect.poll(async () =>
    parseInt(((await page.locator(".sidebar-status-block").innerText()).match(/DEPLOYS:\s*(\d+)/)?.[1]) ?? "0", 10),
    { timeout: 8000 },
  ).toBeGreaterThanOrEqual(1);

  const before = parseInt(
    ((await page.locator(".sidebar-status-block").innerText()).match(/DEPLOYS:\s*(\d+)/)?.[1]) ?? "0",
    10,
  );

  await page.locator('[data-tab="agents"]').click();
  await page.waitForTimeout(200);
  await page.locator('[data-tab="ops"]').click();
  await page.waitForTimeout(200);
  await page.locator('[data-tab="warroom"]').click();
  await page.waitForTimeout(200);

  const after = parseInt(
    ((await page.locator(".sidebar-status-block").innerText()).match(/DEPLOYS:\s*(\d+)/)?.[1]) ?? "0",
    10,
  );
  expect(after).toBeGreaterThanOrEqual(before);
});
```

- [ ] **Step 2: Run spec verify for T6.1.3**

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/sse-persistence.spec.ts
git commit -m "feat: complete T6.1.3 — playwright SSE persistence test"
```

---

## Task 25: T6.1.4 — `tests/e2e/operations-drilldown.spec.ts`

**Files:**
- Create: `tests/e2e/operations-drilldown.spec.ts`

- [ ] **Step 1: Write the spec**

```ts
// tests/e2e/operations-drilldown.spec.ts
import { test, expect } from "@playwright/test";

test("clicking an operations card activates WAR ROOM with that deploy", async ({ page }) => {
  await page.goto("/?tab=ops");
  const cards = page.locator(".ops-card[data-deploy-id]");
  await expect(cards.first()).toBeVisible();
  const count = await cards.count();
  expect(count).toBeGreaterThanOrEqual(5);

  const second = cards.nth(1);
  const id = await second.getAttribute("data-deploy-id");
  expect(id).not.toBeNull();

  await second.click();

  await expect(page.locator('[data-tab="warroom"][data-active="true"]')).toBeVisible();
  await expect(page).toHaveURL(/tab=warroom/);
  await expect(page.locator(`.shell[data-active-deploy="${id}"]`)).toBeVisible();
});
```

- [ ] **Step 2: Run spec verify for T6.1.4**

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/operations-drilldown.spec.ts
git commit -m "feat: complete T6.1.4 — playwright operations drill-down test"
```

---

## Task 26: T6.1.5 — `tests/e2e/systems-polling.spec.ts`

**Files:**
- Create: `tests/e2e/systems-polling.spec.ts`

- [ ] **Step 1: Write the spec**

```ts
// tests/e2e/systems-polling.spec.ts
import { test, expect } from "@playwright/test";

test("Systems tab polls /api/health on a 10s interval", async ({ page }) => {
  let calls = 0;
  await page.route("**/api/health", async (route) => {
    calls++;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        services: [
          { name: "kv", ok: true, latency_ms: 12, last_error: null, extra: "iad1" },
          { name: "ai-gateway", ok: true, latency_ms: 220, last_error: null, extra: "model" },
          { name: "discord", ok: true, latency_ms: 45, last_error: null, extra: "channel" },
          { name: "github", ok: true, latency_ms: 88, last_error: null, extra: "rate 4900/5000" },
        ],
      }),
    });
  });

  await page.goto("/?tab=systems&live=1");
  await expect(page.locator(".service-tile").first()).toBeVisible();

  // Wait 12 seconds for at least one interval tick
  await page.waitForTimeout(12_000);
  expect(calls).toBeGreaterThanOrEqual(2);

  // All 4 service tiles must be present.
  await expect(page.locator(".service-tile")).toHaveCount(4);
});
```

- [ ] **Step 2: Run spec verify for T6.1.5**

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/systems-polling.spec.ts
git commit -m "feat: complete T6.1.5 — playwright systems polling test"
```

---

## Task 27: T6.1.6 — `tests/e2e/agent-drawer.spec.ts`

**Files:**
- Create: `tests/e2e/agent-drawer.spec.ts`

- [ ] **Step 1: Write the spec**

```ts
// tests/e2e/agent-drawer.spec.ts
import { test, expect } from "@playwright/test";

test("clicking a roster row opens the drawer; clicking the overlay dismisses it", async ({ page }) => {
  await page.goto("/?tab=agents");
  await expect(page.locator(".roster-table tbody tr").first()).toBeVisible();

  await page.locator(".roster-table tbody tr").first().click();
  await expect(page.locator('[data-drawer-open="true"]')).toBeVisible();

  // click outside the drawer (overlay)
  await page.locator(".drawer-overlay").click();
  await expect(page.locator('[data-drawer-open="true"]')).toHaveCount(0);
});
```

- [ ] **Step 2: Run spec verify for T6.1.6**

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/agent-drawer.spec.ts
git commit -m "feat: complete T6.1.6 — playwright agent drawer test"
```

---

## Task 28: T6.1.7 — Aggregate e2e suite

**Files:** none (verification stage)

- [ ] **Step 1: Confirm Playwright sees all 5 specs**

```bash
npx playwright test --list
```

Expected: 5 spec files listed (sidebar-nav, sse-persistence, operations-drilldown, systems-polling, agent-drawer).

- [ ] **Step 2: Run the full suite**

```bash
npx playwright test --reporter=list
```

Expected: all 5 specs pass.

- [ ] **Step 3: Run spec verify for T6.1.7**

- [ ] **Step 4: Mark stage complete in `tasks/state.json`. No commit (verification-only).**

---

## Self-Review

**Spec coverage:** ✓ T0.1.1, T0.2.1, T0.2.2, T0.3.1, T0.3.2, T0.3.3, T0.4.1, T1.1.1, T1.1.2, T1.1.3, T2.1.1, T2.1.2, T3.0.1, T3.1.1, T3.1.2, T4.1.1, T4.1.2, T4.1.3, T5.1.1, T5.1.2, T5.1.3, T6.1.1–T6.1.7 — every spec stage has a task. (T1.1.2 is folded into Task 8 with a confirmation step in Task 9, since the live-mode logic ships with the section component in one commit; the spec verify for T1.1.2 still runs as its own gate.)

**Placeholder scan:** none. Every step has either real code or a deterministic command.

**Type consistency:** `DashboardTab` defined in Task 2, used in Tasks 4, 11. `RosterRow` defined in Task 8 (local). `OpsCardData` defined in Task 11 (local). `LatencyClass` defined in Task 17. `Bucket` and `Severity` defined in Task 14. No cross-task signature drift.

**Test hooks placement check:**
- `data-tab` + `data-active` on sidebar buttons → defined Task 4, asserted Tasks 23, 25
- `?tab=...` URL sync via `history.replaceState` → defined Task 2, asserted Task 23
- `data-drawer-open="true"` on drawer root → defined Task 8, asserted Task 27
- `.drawer-overlay` selector for dismiss → defined Task 10 (CSS), expected by Task 27
- `data-deploy-id` on operations cards → defined Task 11, asserted Task 25
- `[data-active-deploy="<id>"]` on WarRoom shell root → defined Task 1, asserted Task 25
- `.sidebar-status-block` text containing `DEPLOYS: <n>` → defined Task 4, asserted Task 24
- `.service-tile` count = 4 → asserted Task 26, defined Task 17
- `f.kind === 'hook'` filter in Intelligence → requires Task 13's union extension before Task 14

All hooks land in producing tasks before their consuming tests.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-02-dashboard-shell.md`. Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?
