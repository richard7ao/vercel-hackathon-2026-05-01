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
