/* eslint-disable */
/* global React, ReactDOM */

const { useState, useEffect, useRef, useMemo, useCallback } = React;
const D = window.__bridgeData;

// ============================================================
// Top bar
// ============================================================
function TopBar({ activeDeploy }) {
  const [t, setT] = useState(new Date());
  useEffect(() => {
    const i = setInterval(() => setT(new Date()), 1000);
    return () => clearInterval(i);
  }, []);
  const utc = t.toISOString().slice(11, 19);
  const date = t.toISOString().slice(0, 10);

  return (
    <div className="topbar">
      <div className="topbar-left">
        <span className="brand">
          BRIDGE<span className="slash">//</span><span className="sub">PRODUCTION WAR ROOM</span>
        </span>
        <span className="crumb">REPO <b>acme/control-plane</b></span>
        <span className="crumb">BRANCH <b>main</b></span>
        <span className="crumb">REGION <b>iad1 · sfo1 · fra1</b></span>
      </div>
      <div className="topbar-right">
        {activeDeploy ? (
          <span className="crumb">FOCUS <b>{activeDeploy.sha}</b> · <span className="path">{activeDeploy.tldr}</span></span>
        ) : (
          <span className="crumb">FOCUS <b className="dim">— no active investigation —</b></span>
        )}
        <span className="live-badge"><span className="live-dot" />LIVE</span>
        <span className="clock tab-num">{date} {utc} UTC</span>
      </div>
    </div>
  );
}

// ============================================================
// Status block
// ============================================================
const STATUS_LABELS = {
  all_clear:  'ALL CLEAR',
  monitoring: 'MONITORING',
  anomaly:    'ANOMALY DETECTED',
  critical:   'CRITICAL',
};

function fmtUptime(sec) {
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (d > 0) return `${d}d ${h.toString().padStart(2,'0')}h`;
  return `${h}h ${m}m`;
}

function StatusBlock({ state, uptime, deploysAnalyzed, agentsStanding, mtta, lastIncident }) {
  const [snap, setSnap] = useState(false);
  const prev = useRef(state);
  useEffect(() => {
    if (prev.current !== state) {
      setSnap(true);
      const t = setTimeout(() => setSnap(false), 240);
      prev.current = state;
      return () => clearTimeout(t);
    }
  }, [state]);

  return (
    <div className="status-block" data-state={state}>
      <span className="corner tl" /><span className="corner tr" />
      <span className="corner bl" /><span className="corner br" />

      <div className="status-side">
        <div className="kv"><span className="k">OPS://</span><span className="v">DEPLOY-MONITOR</span></div>
        <div className="kv"><span className="k">CHANNEL</span><span className="v">#deploys · slack</span></div>
        <div className="kv"><span className="k">SYNTH</span><span className="v">claude-sonnet-4 · v0.7.2</span></div>
        <div className="kv"><span className="k">AGENTS</span><span className="v tab-num">{agentsStanding} STANDING</span></div>
      </div>

      <div className="status-center">
        <div className={"status-state" + (snap ? " snap" : "")}>
          <span className="bracket">[</span>
          <span className="label">{STATUS_LABELS[state]}</span>
          <span className="bracket">]</span>
        </div>
        <div className="status-sub">
          <span>monitoring</span>
          <span className="sep">·</span>
          <span><span className="tab-num">{deploysAnalyzed}</span> deploys analyzed</span>
          <span className="sep">·</span>
          <span className="tab-num">{fmtUptime(uptime)} since last incident</span>
        </div>
      </div>

      <div className="status-side right">
        <div className="kv"><span className="k">RISK BIAS</span><span className="v">P50 0.11 · P95 0.42</span></div>
        <div className="kv"><span className="k">MTTA</span><span className="v tab-num">{mtta}</span></div>
        <div className="kv"><span className="k">SSE</span><span className="v">connected · 4ms</span></div>
        <div className="kv"><span className="k">BUDGET</span><span className="v">42% remaining</span></div>
      </div>
    </div>
  );
}

// ============================================================
// Deploy timeline (SVG)
// ============================================================
function DeployTimeline({ deploys, activeId, onSelect }) {
  const wrap = useRef(null);
  const [tip, setTip] = useState(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    if (!wrap.current) return;
    const ro = new ResizeObserver(() => setW(wrap.current.clientWidth));
    ro.observe(wrap.current);
    setW(wrap.current.clientWidth);
    return () => ro.disconnect();
  }, []);

  const HEIGHT = 64;
  if (!deploys.length || !w) return <div className="timeline-canvas" ref={wrap} />;

  // x range: 30 days back to NOW
  const tMin = D.NOW - 30 * D.DAY;
  const tMax = D.NOW + 0.4 * D.DAY;
  const x = (t) => 8 + ((t - tMin) / (tMax - tMin)) * (w - 16);

  const colorFor = (s) => {
    if (s >= 0.8) return 'var(--red)';
    if (s >= 0.6) return 'var(--orange)';
    if (s >= 0.3) return 'var(--amber)';
    return 'var(--green)';
  };

  // day gridlines
  const gridLines = [];
  for (let i = 0; i <= 30; i += 5) {
    const t = tMin + i * D.DAY;
    gridLines.push(
      <line key={i} x1={x(t)} x2={x(t)} y1={10} y2={HEIGHT - 16} stroke="var(--line)" strokeWidth="1" strokeDasharray="2 3" />
    );
  }

  return (
    <div className="timeline-canvas" ref={wrap}
         onMouseLeave={() => setTip(null)}>
      <svg viewBox={`0 0 ${w} ${HEIGHT}`} preserveAspectRatio="none">
        {/* axis */}
        <line x1="0" x2={w} y1={HEIGHT - 14} y2={HEIGHT - 14} stroke="var(--line-1)" strokeWidth="1" />
        {gridLines}
        {/* date ticks */}
        {[30, 22, 14, 7, 1].map((d, i) => {
          const t = D.NOW - d * D.DAY;
          const dt = new Date(t);
          const m = dt.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' }).toUpperCase();
          return (
            <g key={i}>
              <line x1={x(t)} x2={x(t)} y1={HEIGHT - 16} y2={HEIGHT - 12} stroke="var(--fg-faint)" />
              <text x={x(t)} y={HEIGHT - 3} fontSize="9" fill="var(--fg-mute)" textAnchor="middle"
                    fontFamily="JetBrains Mono" letterSpacing="0.08em">
                {m} {dt.getUTCDate().toString().padStart(2, '0')}
              </text>
            </g>
          );
        })}
        {/* deploys */}
        {deploys.map((d) => {
          const cx = x(+new Date(d.pushed_at));
          const cy = 22 - d.score * 8;
          const r = d.score >= 0.6 ? 3.5 : 2.2;
          const isActive = d.id === activeId;
          return (
            <g key={d.id}
               onMouseEnter={() => setTip({ d, cx, cy })}
               onClick={() => onSelect && onSelect(d)}
               style={{ cursor: 'pointer' }}>
              <circle cx={cx} cy={cy} r={r} fill={colorFor(d.score)}
                      stroke={isActive ? 'var(--fg)' : 'none'}
                      strokeWidth={isActive ? 1.2 : 0}
                      style={d.score >= 0.8 ? { filter: 'drop-shadow(0 0 4px var(--red))' } : null} />
              {/* faint vertical drop */}
              <line x1={cx} x2={cx} y1={cy + r} y2={HEIGHT - 16}
                    stroke={colorFor(d.score)} strokeOpacity={d.score >= 0.6 ? 0.4 : 0.12} />
            </g>
          );
        })}
        {/* NOW marker */}
        <line x1={x(D.NOW)} x2={x(D.NOW)} y1={6} y2={HEIGHT - 14}
              stroke="var(--amber)" strokeWidth="1" strokeDasharray="3 2" />
      </svg>
      {tip && (
        <div className="timeline-tooltip" style={{ left: tip.cx, top: tip.cy }}>
          <div className="row"><span className="k">SHA</span><span className="v">{tip.d.sha}</span></div>
          <div className="row"><span className="k">AUTHOR</span><span className="v">{tip.d.author}</span></div>
          <div className="row"><span className="k">SCORE</span>
            <span className="v" style={{ color: tip.d.score >= 0.6 ? 'var(--red)' : tip.d.score >= 0.3 ? 'var(--amber)' : 'var(--green)' }}>
              {tip.d.score.toFixed(2)}
            </span>
          </div>
          <div className="row" style={{marginTop:4}}><span className="v" style={{color: 'var(--fg-dim)'}}>{tip.d.tldr}</span></div>
        </div>
      )}
    </div>
  );
}

function TimelineRow({ deploys, activeId, onSelect }) {
  const total = deploys.length;
  const last = deploys[deploys.length - 1];
  const lastTs = last ? new Date(last.pushed_at) : new Date();
  return (
    <div className="timeline">
      <div className="timeline-side">
        <div>DEPLOY TIMELINE <span className="dim">// LAST 30D</span></div>
        <div><span className="muted">N=</span><span className="v tab-num">{total}</span> <span className="muted">·</span> <span className="v">P50 0.11</span></div>
      </div>
      <DeployTimeline deploys={deploys} activeId={activeId} onSelect={onSelect} />
      <div className="timeline-side right">
        <div className="now-marker"><span className="tri" />NOW</div>
        <div className="muted tab-num">{lastTs.toISOString().slice(11,16)}Z</div>
        <div className="muted">+0.4d HORIZON</div>
      </div>
    </div>
  );
}

// ============================================================
// Investigator agent cards
// ============================================================
function AgentCard({ def, state }) {
  const streamRef = useRef(null);
  useEffect(() => {
    if (streamRef.current) streamRef.current.scrollTop = streamRef.current.scrollHeight;
  }, [state.lines]);

  const status = state.status;
  const lines = state.lines || [];
  const finding = state.finding;

  return (
    <div className="agent" data-status={status}>
      <div className="agent-head">
        <div className="agent-name">
          <span className="idx">{def.idx}</span>
          {def.name} <span className="role">/ {def.role}</span>
        </div>
        <div className="agent-status">
          <span className="stat-dot" />
          [ {status.toUpperCase()} ]
        </div>
      </div>

      <div className="agent-meta">
        <span>STEPS <span className="v tab-num">{state.steps || 0}</span></span>
        <span>TOK <span className="v tab-num">{state.tokens || 0}</span></span>
        <span>LAT <span className="v tab-num">{state.latency || '—'}</span></span>
        {state.tool && <span>TOOL <span className="v">{state.tool}</span></span>}
      </div>

      <div className="agent-stream" ref={streamRef}>
        {lines.length === 0 && status === 'idle' && (
          <div className="line"><span className="ts">--:--:--</span><span className="body" style={{color:'var(--fg-faint)'}}>standing by</span></div>
        )}
        {lines.map((l, i) => (
          <div key={i} className={"line" + (l.cur ? ' cur' : '')}>
            <span className="ts">{l.ts}</span>
            <span className="body">{l.text}</span>
          </div>
        ))}
      </div>

      {finding && (
        <div className="agent-finding">
          <span className={'sev ' + finding.severity} />
          <span>{finding.summary}</span>
        </div>
      )}
    </div>
  );
}

function AgentsPanel({ agents }) {
  const completed = D.AGENT_DEFS.filter(d => agents[d.key]?.status === 'complete').length;
  const investigating = D.AGENT_DEFS.filter(d => ['dispatched','investigating'].includes(agents[d.key]?.status)).length;
  return (
    <div className="panel">
      <div className="panel-header">
        <div className="title"><span className="pre">[04]</span> INVESTIGATOR AGENTS <span className="pre">// PARALLEL FAN-OUT</span></div>
        <div className="right">
          <span>ACTIVE <span style={{color:'var(--amber)'}}>{investigating}</span>/5</span>
          <span>DONE <span style={{color:'var(--green)'}}>{completed}</span>/5</span>
        </div>
      </div>
      <div className="panel-body">
        <div className="agents-grid">
          {D.AGENT_DEFS.map(def => (
            <AgentCard key={def.key} def={def} state={agents[def.key] || { status: 'idle', lines: [] }} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Live feed
// ============================================================
function FeedLine({ line }) {
  // Render message with simple inline markup parsing
  const renderMsg = (txt) => {
    const parts = [];
    const re = /(`[^`]+`)|(@[a-z0-9-]+)|(\[PAGE\])/gi;
    let last = 0; let m; let i = 0;
    while ((m = re.exec(txt)) !== null) {
      if (m.index > last) parts.push(<span key={i++}>{txt.slice(last, m.index)}</span>);
      const tok = m[0];
      if (tok.startsWith('`')) parts.push(<span key={i++} className="code">{tok.slice(1, -1)}</span>);
      else if (tok.startsWith('@')) parts.push(<span key={i++} className="mention">{tok}</span>);
      else if (tok === '[PAGE]') parts.push(<span key={i++} className="page-tag">PAGE</span>);
      last = m.index + tok.length;
    }
    if (last < txt.length) parts.push(<span key={i++}>{txt.slice(last)}</span>);
    return parts;
  };

  let prefix;
  if (line.kind === 'sys')      prefix = <span className="muted">SYS</span>;
  else if (line.kind === 'bot') prefix = <span style={{color:'var(--amber)'}}>BRDG</span>;
  else if (line.kind === 'msg') prefix = <span className="author">{line.author || '—'}</span>;
  else                          prefix = <span className="muted">··</span>;

  return (
    <div className="feed-line" data-sev={line.severity}>
      <span className="ts">{line.ts}</span>
      <span className="marker">{line.severity === 'critical' ? '▲' : line.severity === 'warn' ? '◆' : '·'}</span>
      <span className="msg">
        <span style={{marginRight:8}}>{prefix}</span>
        {renderMsg(line.message)}
      </span>
    </div>
  );
}

function FeedPanel({ feed }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [feed.length]);
  return (
    <div className="panel">
      <div className="panel-header">
        <div className="title">
          <span className="pre">[05]</span> LIVE FEED <span className="pre">// #deploys</span>
        </div>
        <div className="right">
          <span className="live-dot" style={{display:'inline-block',marginRight:6}} />
          <span style={{color:'var(--green)'}}>SLACK · CONNECTED</span>
        </div>
      </div>
      <div className="panel-body" style={{position:'relative'}}>
        <div className="fade-edge-top" />
        <div className="feed" ref={ref}>
          {feed.map((l, i) => <FeedLine key={i} line={l} />)}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Heatmap
// ============================================================
function HeatmapPanel({ grid, peakCell }) {
  const cols = grid[0]?.length || 0;
  return (
    <div className="panel">
      <div className="panel-header">
        <div className="title">
          <span className="pre">[06]</span> ANOMALY HEATMAP <span className="pre">// FILES × HOURS · 7D</span>
        </div>
        <div className="right">
          <span className="muted">σ</span> <span style={{color:'var(--fg)'}}>0.18</span>
          <span className="muted">·</span>
          <span className="muted">PEAK</span> <span style={{color:'var(--amber)'}}>0.81</span>
        </div>
      </div>
      <div className="panel-body">
        <div className="heatmap-wrap">
          <div className="heatmap-files">
            {D.HEATMAP_FILES.map((f, i) => (
              <div key={i} className="file" title={f}>
                <span style={{color:'var(--fg-mute)',marginRight:6}}>{(i+1).toString().padStart(2,'0')}</span>
                {f}
              </div>
            ))}
          </div>
          <div className="heatmap-grid-wrap">
            <div className="heatmap-grid"
                 style={{ gridTemplateColumns: `repeat(${cols}, 1fr)`, gridTemplateRows: `repeat(${grid.length}, 1fr)` }}>
              {grid.map((row, r) =>
                row.map((v, c) => {
                  const isPeakRed = peakCell && peakCell.r === r && peakCell.c === c;
                  const isHigh = v > 0.55;
                  const alpha = Math.min(1, v * 1.2);
                  const bg = isHigh
                    ? `rgba(255,136,0,${alpha})`
                    : `rgba(255,136,0,${alpha * 0.6})`;
                  return (
                    <div key={r + '-' + c}
                         className={"heatmap-cell" + (isHigh ? ' peak' : '') + (isPeakRed ? ' peak-red' : '')}
                         style={{ background: bg }}
                         title={`${D.HEATMAP_FILES[r]} · σ ${v.toFixed(2)}`} />
                  );
                })
              )}
            </div>
            <div className="heatmap-axis">
              <span>−7D</span><span>−5D</span><span>−3D</span><span>−24H</span><span>NOW</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Threat surface
// ============================================================
function fmtAge(sec) {
  if (sec < 60) return Math.floor(sec) + 's';
  if (sec < 3600) return Math.floor(sec / 60) + 'm';
  if (sec < 86400) return Math.floor(sec / 3600) + 'h';
  return Math.floor(sec / 86400) + 'd';
}

function ThreatPanel({ threats }) {
  const open = threats.filter(t => t.status === 'open').length;
  return (
    <div className="panel">
      <div className="panel-header">
        <div className="title">
          <span className="pre">[07]</span> THREAT SURFACE <span className="pre">// {open} OPEN</span>
        </div>
        <div className="right">
          <span className="muted">SCAN</span>
          <span style={{color:'var(--green)'}}>·</span>
          <span style={{color:'var(--fg)'}}>14s ago</span>
        </div>
      </div>
      <div className="panel-body">
        <div className="threats">
          {threats.length === 0 && (
            <div style={{padding: '20px 14px', color: 'var(--fg-mute)', fontSize: 11}}>// no open items</div>
          )}
          {threats.map(t => (
            <div key={t.id} className={"threat" + (t.justAdded ? ' new' : '')} data-sev={t.severity}>
              <span className="sev-dot" />
              <div className="desc">
                {t.description}
                <div className="meta">
                  <span>SEV <b style={{color:'var(--fg-dim)'}}>{t.severity.toUpperCase()}</b></span>
                  {t.deploy_ref && <span>DEP <b style={{color:'var(--amber)'}}>{t.deploy_ref}</b></span>}
                  {t.file && <span>FILE <b className="path">{t.file}</b></span>}
                  <span>STATUS <b style={{color:'var(--fg-dim)'}}>{t.status.toUpperCase()}</b></span>
                </div>
              </div>
              <span className="age">{fmtAge(t.age_seconds)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Verdict modal
// ============================================================
function VerdictModal({ verdict, onClose, onPage }) {
  if (!verdict) return null;
  return (
    <div className="verdict">
      <div className="verdict-head">
        <span>SYNTHESIZER VERDICT // dep_{verdict.deploy_id_short}</span>
        <button className="x" onClick={onClose}>[ X ]</button>
      </div>
      <div className="verdict-body">
        <div className="verdict-level">[ {verdict.level.toUpperCase()} ]</div>
        <div className="verdict-summary">{verdict.summary}</div>

        <div className="verdict-section-label">CONCERNS · {verdict.concerns.length}</div>
        <ul className="verdict-concerns">
          {verdict.concerns.map((c, i) => <li key={i}>{c}</li>)}
        </ul>

        <div className="verdict-section-label">SUGGESTED ACTION</div>
        <div className="verdict-action">
          <span className="lbl">recommended</span>
          {verdict.suggested_action}
        </div>

        <div className="verdict-actions-row">
          <button className="btn" onClick={onClose}>ACKNOWLEDGE</button>
          <button className="btn primary" onClick={onClose}>HOLD ROLLBACK</button>
          <button className="btn danger" onClick={onPage}>PAGE @oncall</button>
        </div>
      </div>
    </div>
  );
}

// expose
window.__bridgeComponents = {
  TopBar, StatusBlock, TimelineRow, AgentsPanel, FeedPanel, HeatmapPanel, ThreatPanel, VerdictModal,
};
