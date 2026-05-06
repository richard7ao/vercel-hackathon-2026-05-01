export type Evidence = { url: string; line: number };

export type DetectResult = {
  matched: boolean;
  severity: number;
  evidence: Evidence[];
};

type FileInput = {
  path?: string;
  patch?: string;
};

const HIGH_VALUE_PATH = /\b(auth|wires|admin)\b/i;

const URL_PATTERNS = [
  /fetch\s*\(\s*['"]((https?:\/\/)[^'"]+)['"]/,
  /fetch\s*\(\s*`((https?:\/\/)[^`]+)/,
  /axios\s*\(\s*['"]((https?:\/\/)[^'"]+)['"]/,
  /axios\.\w+\s*\(\s*['"]((https?:\/\/)[^'"]+)['"]/,
  /axios\.create\s*\([^)]*baseURL\s*:\s*['"]((https?:\/\/)[^'"]+)['"]/,
];

function extractUrl(line: string): string | null {
  for (const pattern of URL_PATTERNS) {
    const m = line.match(pattern);
    if (m) return m[1];
  }
  return null;
}

function extractHostname(url: string): string | null {
  const m = url.match(/^https?:\/\/([^/:\s`'"$]+)/);
  return m ? m[1] : null;
}

function isAllowlisted(url: string, allowlist: string[]): boolean {
  const hostname = extractHostname(url);
  if (!hostname) return false;
  return allowlist.some((glob) => {
    if (glob.startsWith("*.")) {
      return hostname.endsWith(glob.slice(1));
    }
    return hostname === glob;
  });
}

function isComment(line: string): boolean {
  return line.startsWith("//") || line.startsWith("/*") || line.startsWith("*");
}

const AUTH_KEYWORDS = ["auth", "session", "token", "permission", "middleware"];

const SECRET_PATTERNS = [
  /AKIA[0-9A-Z]{16}/,
  /[A-Za-z0-9/+=]{40}/,
  /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/,
  /(api[_-]?key|secret)\s*[:=]\s*['"][A-Za-z0-9]{20,}['"]/i,
];

function globMatch(pattern: string, path: string): boolean {
  const re = new RegExp(
    "^" +
      pattern
        .replace(/[.+^${}()|[\]\\]/g, "\\$&")
        .replace(/\*/g, ".*") +
      "$"
  );
  return re.test(path);
}

export function detectCriticalPath(
  file: FileInput,
  paths: string[]
): DetectResult {
  const filePath = file.path ?? "";
  if (!filePath) return { matched: false, severity: 0, evidence: [] };

  const hit = paths.some((p) => globMatch(p, filePath));
  if (!hit) return { matched: false, severity: 0, evidence: [] };

  return { matched: true, severity: 0.85, evidence: [] };
}

export function detectSecretShapes(file: FileInput): DetectResult {
  const patch = file.patch;
  if (!patch) return { matched: false, severity: 0, evidence: [] };

  const lines = patch.split("\n");
  const evidence: Evidence[] = [];
  let addedLineIndex = 0;

  for (const raw of lines) {
    if (!raw.startsWith("+")) continue;
    addedLineIndex++;
    const code = raw.slice(1).trim();
    if (isComment(code)) continue;

    for (const pattern of SECRET_PATTERNS) {
      if (pattern.test(code)) {
        evidence.push({ url: pattern.source, line: addedLineIndex });
        break;
      }
    }
  }

  if (evidence.length === 0) return { matched: false, severity: 0, evidence: [] };
  return { matched: true, severity: 0.95, evidence };
}

export function detectAuthPath(file: FileInput): DetectResult {
  const path = file.path ?? "";
  if (!path) return { matched: false, severity: 0, evidence: [] };

  const lower = path.toLowerCase();
  const hits = AUTH_KEYWORDS.filter((kw) => lower.includes(kw));
  if (hits.length === 0) return { matched: false, severity: 0, evidence: [] };

  const severity = Math.min(0.3 + hits.length * 0.25, 1.0);
  return { matched: true, severity, evidence: [] };
}

type DepEvidence = { name: string; version: string };

export type DepDetectResult = {
  matched: boolean;
  severity: number;
  evidence: DepEvidence[];
};

const DEP_LINE = /^\+\s*"([^"]+)"\s*:\s*"([^"]+)"/;

export function detectNewEndpoint(file: FileInput & { additions?: number; deletions?: number; status?: string }): DetectResult {
  const path = file.path ?? "";
  if (!path.startsWith("app/api/")) return { matched: false, severity: 0, evidence: [] };
  if (file.status !== "added") return { matched: false, severity: 0, evidence: [] };
  if ((file.deletions ?? 0) > 0) return { matched: false, severity: 0, evidence: [] };

  const isAdmin = /\b(admin|payment|billing|wires)\b/i.test(path);
  const severity = isAdmin ? 0.85 : 0.6;
  return { matched: true, severity, evidence: [] };
}

export function detectNewDependency(file: FileInput): DepDetectResult {
  if (!file.path?.endsWith("package.json") || !file.patch) {
    return { matched: false, severity: 0, evidence: [] };
  }

  const evidence: DepEvidence[] = [];
  for (const raw of file.patch.split("\n")) {
    const m = raw.match(DEP_LINE);
    if (m) evidence.push({ name: m[1], version: m[2] });
  }

  if (evidence.length === 0) return { matched: false, severity: 0, evidence: [] };
  return { matched: true, severity: 0.5 + Math.min(evidence.length * 0.1, 0.4), evidence };
}

export function detectExternalFetch(
  file: FileInput,
  allowlist?: string[]
): DetectResult {
  const patch = file.patch;
  if (!patch) {
    return { matched: false, severity: 0, evidence: [] };
  }

  const lines = patch.split("\n");
  const evidence: Evidence[] = [];
  let addedLineIndex = 0;

  for (const raw of lines) {
    if (!raw.startsWith("+")) continue;
    addedLineIndex++;

    if (isComment(raw.slice(1).trim())) continue;

    const url = extractUrl(raw);
    if (!url) continue;
    if (allowlist && isAllowlisted(url, allowlist)) continue;

    evidence.push({ url, line: addedLineIndex });
  }

  if (evidence.length === 0) {
    return { matched: false, severity: 0, evidence: [] };
  }

  const severity = HIGH_VALUE_PATH.test(file.path ?? "") ? 0.9 : 0.6;
  return { matched: true, severity, evidence };
}
