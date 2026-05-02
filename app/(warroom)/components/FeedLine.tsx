"use client";

import type { FeedEntry } from "../data";

export function FeedLine({ line }: { line: FeedEntry }) {
  // Render message with simple inline markup parsing
  const renderMsg = (txt: string) => {
    const parts: React.ReactNode[] = [];
    const re = /(`[^`]+`)|(@[a-z0-9-]+)|(\[PAGE\])/gi;
    let last = 0;
    let m: RegExpExecArray | null;
    let i = 0;
    while ((m = re.exec(txt)) !== null) {
      if (m.index > last)
        parts.push(<span key={i++}>{txt.slice(last, m.index)}</span>);
      const tok = m[0];
      if (tok.startsWith("`"))
        parts.push(
          <span key={i++} className="code">
            {tok.slice(1, -1)}
          </span>
        );
      else if (tok.startsWith("@"))
        parts.push(
          <span key={i++} className="mention">
            {tok}
          </span>
        );
      else if (tok === "[PAGE]")
        parts.push(
          <span key={i++} className="page-tag">
            PAGE
          </span>
        );
      last = m.index + tok.length;
    }
    if (last < txt.length)
      parts.push(<span key={i++}>{txt.slice(last)}</span>);
    return parts;
  };

  let prefix: React.ReactNode;
  if (line.kind === "sys") prefix = <span className="muted">SYS</span>;
  else if (line.kind === "bot")
    prefix = <span style={{ color: "var(--amber)" }}>BRDG</span>;
  else if (line.kind === "msg")
    prefix = <span className="author">{line.author || "—"}</span>;
  else prefix = <span className="muted">&middot;&middot;</span>;

  return (
    <div className="feed-line" data-sev={line.severity}>
      <span className="ts">{line.ts}</span>
      <span className="marker">
        {line.severity === "critical"
          ? "▲"
          : line.severity === "warn"
            ? "◆"
            : "·"}
      </span>
      <span className="msg">
        <span style={{ marginRight: 8 }}>{prefix}</span>
        {renderMsg(line.message)}
      </span>
    </div>
  );
}
