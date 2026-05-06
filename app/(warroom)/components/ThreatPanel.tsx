"use client";

import type { Threat } from "../data";

function fmtAge(sec: number): string {
  if (sec < 60) return Math.floor(sec) + "s";
  if (sec < 3600) return Math.floor(sec / 60) + "m";
  if (sec < 86400) return Math.floor(sec / 3600) + "h";
  return Math.floor(sec / 86400) + "d";
}

export function ThreatPanel({ threats }: { threats: Threat[] }) {
  const open = threats.filter((t) => t.status === "open").length;
  return (
    <div className="panel">
      <div className="panel-header">
        <div className="title">
          <span className="pre">[07]</span> THREAT SURFACE{" "}
          <span className="pre">// {open} OPEN</span>
        </div>
        <div className="right">
          <span className="muted">SCAN</span>
          <span style={{ color: "var(--green)" }}>&middot;</span>
          <span style={{ color: "var(--fg)" }}>14s ago</span>
        </div>
      </div>
      <div className="panel-body">
        <div className="threats">
          {threats.length === 0 && (
            <div
              style={{
                padding: "20px 14px",
                color: "var(--fg-mute)",
                fontSize: 11,
              }}
            >
              // no open items
            </div>
          )}
          {threats.map((t) => (
            <div
              key={t.id}
              className={"threat" + (t.justAdded ? " new" : "")}
              data-sev={t.severity}
            >
              <span className="sev-dot" />
              <div className="desc">
                {t.description}
                <div className="meta">
                  <span>
                    SEV{" "}
                    <b style={{ color: "var(--fg-dim)" }}>
                      {t.severity.toUpperCase()}
                    </b>
                  </span>
                  {t.deploy_ref && (
                    <span>
                      DEP{" "}
                      <b style={{ color: "var(--amber)" }}>{t.deploy_ref}</b>
                    </span>
                  )}
                  {t.file && (
                    <span>
                      FILE <b className="path">{t.file}</b>
                    </span>
                  )}
                  <span>
                    STATUS{" "}
                    <b style={{ color: "var(--fg-dim)" }}>
                      {t.status.toUpperCase()}
                    </b>
                  </span>
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
