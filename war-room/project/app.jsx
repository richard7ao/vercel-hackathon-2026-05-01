/* eslint-disable */
/* global React, ReactDOM */

const { useState, useEffect, useRef, useCallback } = React;
const D = window.__bridgeData;
const C = window.__bridgeComponents;

// ============================================================
// Demo runner — orchestrates the 25s scenario
// ============================================================

function nowTs(offsetMs = 0) {
  return new Date(Date.now() + offsetMs).toISOString().slice(11, 19);
}

function useDemo() {
  // Status block state
  const [state, setState] = useState('all_clear');
  const [uptime, setUptime] = useState(12 * 86400 + 4 * 3600 + 11 * 60);
  const [deploysAnalyzed, setDeploysAnalyzed] = useState(47);
  const [agentsStanding, setAgentsStanding] = useState(5);
  const [mtta, setMtta] = useState('1.2s');

  // Deploys
  const [deploys, setDeploys] = useState(D.INITIAL_DEPLOYS);
  const [activeDeploy, setActiveDeploy] = useState(null);

  // Agents
  const [agents, setAgents] = useState(() => {
    const o = {};
    D.AGENT_DEFS.forEach(a => o[a.key] = { status: 'idle', lines: [], steps: 0, tokens: 0, latency: '—' });
    return o;
  });

  // Feed
  const [feed, setFeed] = useState(D.INITIAL_FEED);

  // Heatmap + peak
  const [heatmap, setHeatmap] = useState(D.INITIAL_HEATMAP);
  const [peakCell, setPeakCell] = useState(null);

  // Threats
  const [threats, setThreats] = useState(D.INITIAL_THREATS);

  // Verdict modal
  const [verdict, setVerdict] = useState(null);

  // Demo state
  const [running, setRunning] = useState(false);
  const timeoutsRef = useRef([]);

  const at = useCallback((sec, fn) => {
    const id = setTimeout(fn, sec * 1000);
    timeoutsRef.current.push(id);
  }, []);

  const clearAll = () => {
    timeoutsRef.current.forEach(clearTimeout);
    timeoutsRef.current = [];
  };

  // tick uptime every second
  useEffect(() => {
    const i = setInterval(() => setUptime(u => u + 1), 1000);
    return () => clearInterval(i);
  }, []);

  // Helpers to update an agent
  const setAgent = useCallback((key, patch) => {
    setAgents(prev => ({
      ...prev,
      [key]: { ...prev[key], ...(typeof patch === 'function' ? patch(prev[key]) : patch) },
    }));
  }, []);

  const pushAgentLine = useCallback((key, text) => {
    setAgents(prev => {
      const a = prev[key];
      const lines = (a.lines || []).map(l => ({ ...l, cur: false }));
      lines.push({ ts: nowTs(), text, cur: true });
      return { ...prev, [key]: { ...a, lines, steps: (a.steps || 0) + 1, tokens: (a.tokens || 0) + Math.floor(80 + Math.random() * 220) } };
    });
  }, []);

  const finalizeAgent = useCallback((key, finding, latency) => {
    setAgents(prev => {
      const a = prev[key];
      const lines = (a.lines || []).map(l => ({ ...l, cur: false }));
      return { ...prev, [key]: { ...a, status: 'complete', lines, finding, latency } };
    });
  }, []);

  const pushFeed = useCallback((entry) => {
    setFeed(prev => [...prev, { ts: nowTs(), ...entry }]);
  }, []);

  const reset = useCallback(() => {
    clearAll();
    setRunning(false);
    setState('all_clear');
    setDeploys(D.INITIAL_DEPLOYS);
    setActiveDeploy(null);
    setDeploysAnalyzed(47);
    setAgents(() => {
      const o = {};
      D.AGENT_DEFS.forEach(a => o[a.key] = { status: 'idle', lines: [], steps: 0, tokens: 0, latency: '—' });
      return o;
    });
    setFeed(D.INITIAL_FEED);
    setHeatmap(D.INITIAL_HEATMAP);
    setPeakCell(null);
    setThreats(D.INITIAL_THREATS);
    setVerdict(null);
    setMtta('1.2s');
  }, []);

  const runDemo = useCallback(() => {
    if (running) return;
    clearAll();
    setRunning(true);
    setVerdict(null);

    const newDeploy = {
      id: 'dep_048',
      sha: 'a4f2c91',
      author: 'dev-3',
      pushed_at: new Date().toISOString(),
      tldr: 'refactor auth, add metrics emitter',
      score: 0.0, // unknown initially
      files_changed: ['lib/auth.ts', 'lib/auth/session.ts', 'lib/observability/emit.ts'],
    };

    // t=0 — feed quiet line
    at(0.4, () => {
      pushFeed({ severity: 'info', kind: 'sys', message: 'demo scenario armed · injecting synthetic deploy stream' });
    });

    // t=2 — new push detected
    at(2, () => {
      pushFeed({ severity: 'info', kind: 'msg', author: 'dev-3', message: 'pushing the auth refactor real quick before standup' });
      pushFeed({ severity: 'info', kind: 'bot', message: 'push detected · sha `a4f2c91` · `lib/auth.ts` +2 files · author `dev-3`' });
    });

    // t=3 — status to monitoring + dot appears (gray)
    at(3, () => {
      setState('monitoring');
      setDeploys(prev => [...prev, { ...newDeploy, score: 0.05 }]);
      setActiveDeploy({ ...newDeploy, score: 0.05 });
      setDeploysAnalyzed(48);
      pushFeed({ severity: 'warn', kind: 'bot', message: 'scoring `a4f2c91` · structural · behavioral · temporal signals…' });
    });

    // t=4 — score arrives, critical
    at(4, () => {
      setDeploys(prev => prev.map(d => d.id === 'dep_048' ? { ...d, score: 0.91 } : d));
      setActiveDeploy(prev => prev ? { ...prev, score: 0.91 } : prev);
      setState('critical');
      pushFeed({ severity: 'critical', kind: 'bot', message: 'risk score `0.91` // structural=0.88 · behavioral=0.72 · temporal=0.94 · compounds=author-novelty + off-hours' });
      setMtta('0.7s');
    });

    // t=5 — agents IDLE -> DISPATCHED, staggered
    const order = ['trace', 'runtime', 'history', 'dependency', 'diff'];
    order.forEach((k, i) => {
      at(5 + i * 0.15, () => {
        setAgent(k, { status: 'dispatched', lines: [{ ts: nowTs(), text: 'dispatch ack · waking workflow…' }] });
      });
    });
    at(5.4, () => pushFeed({ severity: 'warn', kind: 'bot', message: 'dispatching 5 investigator agents in parallel · workflow `wf_88a2`' }));

    // t=6 — INVESTIGATING
    order.forEach((k, i) => {
      at(6 + i * 0.12, () => {
        setAgent(k, prev => ({
          ...prev,
          status: 'investigating',
          tool: { trace:'otlp.query', runtime:'metrics.q', history:'git.log', dependency:'sbom.diff', diff:'ast.walk' }[k],
        }));
      });
    });

    // t=7..12 — streaming actions per agent
    const streams = {
      trace: [
        'GET /traces?service=auth&since=15m',
        'parsed 12,418 spans across 3 services',
        'comparing span graph to 7d baseline · no novel patterns',
      ],
      runtime: [
        'GET /metrics/p95?route=/login',
        'p50 unchanged · p95 +6ms · within σ band',
        'memory rss flat · gc cycles nominal',
      ],
      history: [
        'git log --author=dev-3 -- lib/auth.ts',
        '0 prior commits to lib/auth/* by `dev-3`',
        'cross-ref CODEOWNERS · `dev-3` not on auth team',
      ],
      dependency: [
        'sbom.diff sha:a4f2c91 vs main',
        'no new packages · 0 transitive added',
        'lockfile clean · integrity hashes match',
      ],
      diff: [
        'ast.walk lib/auth.ts · 184 nodes',
        'detected new fetch() at line 247',
        'destination `https://stats-collector.io/track` · NOT in allowlist',
      ],
    };
    Object.entries(streams).forEach(([k, lines]) => {
      lines.forEach((text, i) => {
        at(7 + i * 1.5 + Math.random() * 0.3, () => pushAgentLine(k, text));
      });
    });

    // t=13–17 — completions
    at(13, () => {
      finalizeAgent('trace', { severity: 'low', summary: 'No new error patterns. Trace topology matches 7d baseline.' }, '4.8s');
      pushFeed({ severity: 'info', kind: 'bot', message: '`trace` complete · benign · 4.8s' });
    });
    at(14, () => {
      finalizeAgent('history', { severity: 'critical', summary: 'Author has never modified auth code · not in CODEOWNERS.' }, '5.1s');
      pushFeed({ severity: 'critical', kind: 'bot', message: '`history` complete · `dev-3` has 0 prior commits to `lib/auth/*` // novel author' });
    });
    at(15, () => {
      finalizeAgent('dependency', { severity: 'low', summary: 'No new dependencies. Lockfile integrity clean.' }, '3.7s');
      pushFeed({ severity: 'info', kind: 'bot', message: '`dependency` complete · benign · 3.7s' });
    });
    at(16, () => {
      finalizeAgent('diff', { severity: 'critical', summary: 'New external fetch() to `stats-collector.io` · NOT allowlisted.' }, '6.2s');
      pushFeed({ severity: 'critical', kind: 'bot', message: '`diff` complete // exfil candidate: `https://stats-collector.io/track` injected at `lib/auth.ts:247`' });
      setPeakCell({ r: 1, c: 29 });
    });
    at(17, () => {
      finalizeAgent('runtime', { severity: 'medium', summary: 'No runtime anomalies yet. Window: last 4 minutes.' }, '7.0s');
      pushFeed({ severity: 'warn', kind: 'bot', message: '`runtime` complete · provisional · 7.0s · window too short for confident verdict' });
    });

    // t=18 — verdict modal
    at(18, () => {
      setVerdict({
        deploy_id_short: '048 · a4f2c91',
        level: 'critical',
        summary: 'Synthesizer collapses 5 inspector findings into a high-confidence verdict: this push contains an unannounced exfil channel inside the auth path, authored by a contributor with no prior history in this code area.',
        concerns: [
          'New external fetch() to `stats-collector.io` injected at lib/auth.ts:247 — not in allowlist.',
          'Author `dev-3` has 0 prior commits to lib/auth/*; not in CODEOWNERS for this path.',
          'Push at 03:42 UTC is outside the team\'s normal commit window (P10–P90 = 14:00–22:00 UTC).',
        ],
        suggested_action: 'Hold the deploy at 0% rollout. Page @oncall-security. Open incident channel and request a forced-revert.',
      });
      pushFeed({ severity: 'critical', kind: 'bot', message: 'synthesizer verdict ready · level=`CRITICAL` · 3 concerns · see verdict panel →' });
    });

    // t=19 — threat surface gains item
    at(19, () => {
      setThreats(prev => [
        {
          id: 'th_NEW',
          severity: 'critical',
          description: 'Unauthorized `fetch()` to external host injected in auth path',
          age_seconds: 0,
          status: 'open',
          deploy_ref: 'a4f2c91',
          file: 'lib/auth.ts:247',
          justAdded: true,
        },
        {
          id: 'th_002',
          severity: 'high',
          description: 'Author novelty // `dev-3` modifying CODEOWNERS-protected path without review',
          age_seconds: 60,
          status: 'open',
          deploy_ref: 'a4f2c91',
          justAdded: true,
        },
        ...prev,
      ]);
    });

    // t=20 — slack thread + PAGE
    at(20, () => {
      pushFeed({ severity: 'info', kind: 'msg', author: 'oncall-bot', message: '@dev-3 @sec-team please ack — auto-rollback held pending review' });
      pushFeed({ severity: 'critical', kind: 'bot', message: 'paging on-call · severity=SEV-1 · runbook `RB-auth-exfil` // [PAGE] @sec-oncall' });
    });
    at(21.5, () => {
      pushFeed({ severity: 'info', kind: 'msg', author: 'sec-oncall', message: 'ack, on it. holding rollout at 0%. opening incident.' });
    });
    at(23, () => {
      pushFeed({ severity: 'warn', kind: 'bot', message: 'rollback armed · no traffic served · waiting on human approval' });
    });

    at(25, () => {
      pushFeed({ severity: 'info', kind: 'sys', message: 'demo hold · final state · press RESET to re-arm' });
      setRunning(false);
    });
  }, [running, at, pushAgentLine, finalizeAgent, pushFeed, setAgent]);

  // auto-start after 3s
  const auto = useRef(false);
  useEffect(() => {
    if (auto.current) return; auto.current = true;
    const t = setTimeout(() => runDemo(), 3000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // cleanup on unmount
  useEffect(() => () => clearAll(), []);

  return {
    state, uptime, deploysAnalyzed, agentsStanding, mtta,
    deploys, activeDeploy, setActiveDeploy,
    agents, feed, heatmap, peakCell, threats,
    verdict, setVerdict,
    runDemo, reset, running,
  };
}

// ============================================================
// App shell
// ============================================================
function App() {
  const demo = useDemo();

  return (
    <div className="shell">
      <C.TopBar activeDeploy={demo.activeDeploy} />

      <C.StatusBlock
        state={demo.state}
        uptime={demo.uptime}
        deploysAnalyzed={demo.deploysAnalyzed}
        agentsStanding={demo.agentsStanding}
        mtta={demo.mtta}
      />

      <C.TimelineRow
        deploys={demo.deploys}
        activeId={demo.activeDeploy?.id}
        onSelect={demo.setActiveDeploy}
      />

      <div className="main-grid">
        <C.AgentsPanel agents={demo.agents} />
        <C.FeedPanel feed={demo.feed} />
        <C.HeatmapPanel grid={demo.heatmap} peakCell={demo.peakCell} />
        <C.ThreatPanel threats={demo.threats} />
      </div>

      <C.VerdictModal
        verdict={demo.verdict}
        onClose={() => demo.setVerdict(null)}
        onPage={() => demo.setVerdict(null)}
      />

      <div className="demo-ctrl">
        {!demo.running && (
          <button className="btn primary" onClick={demo.runDemo}>▶ RUN DEMO</button>
        )}
        <button className="btn" onClick={demo.reset}>↺ RESET</button>
      </div>

      <div className="scanlines" />
      <div className="vignette" />
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
