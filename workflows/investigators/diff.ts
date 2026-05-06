"use step";

import {
  type InvestigatorInput,
  type InvestigatorResult,
  emitInvestigatorEvent,
  writeAgentMemory,
} from "./_base";

const SECURITY_PATTERNS = [
  { pattern: /eval\s*\(/, label: "eval() usage" },
  { pattern: /exec\s*\(/, label: "exec() usage" },
  { pattern: /Function\s*\(/, label: "Function() constructor" },
  { pattern: /innerHTML\s*=/, label: "innerHTML assignment (XSS risk)" },
  { pattern: /dangerouslySetInnerHTML/, label: "dangerouslySetInnerHTML" },
  { pattern: /catch\s*\([^)]*\)\s*\{\s*\}/, label: "empty catch block" },
  { pattern: /catch\s*\{/, label: "empty catch block" },
  { pattern: /disable.*auth|bypass.*check|skip.*validation/i, label: "auth bypass language" },
  { pattern: /process\.env\.\w+.*\|\|.*['"]/, label: "env fallback to hardcoded value" },
];

export { diffDeterministic as diffInvestigator };

export async function diffDeterministic(
  input: InvestigatorInput
): Promise<InvestigatorResult> {
  const agent = "diff";
  await emitInvestigatorEvent(input.deploy_id, agent, "dispatched");

  await emitInvestigatorEvent(
    input.deploy_id,
    agent,
    "investigating",
    "scanning patches for security patterns"
  );

  const concerns: string[] = [];

  for (const file of input.files) {
    if (!file.patch) continue;
    const addedLines = file.patch
      .split("\n")
      .filter((l) => l.startsWith("+"))
      .map((l) => l.slice(1));

    for (const line of addedLines) {
      for (const { pattern, label } of SECURITY_PATTERNS) {
        if (pattern.test(line)) {
          concerns.push(`${file.path}: ${label}`);
        }
      }
    }
  }

  let severity: "low" | "medium" | "high" | "critical" = "low";
  if (concerns.length >= 3) severity = "critical";
  else if (concerns.length >= 2) severity = "high";
  else if (concerns.length >= 1) severity = "medium";

  const summary =
    concerns.length > 0
      ? `Found ${concerns.length} security concern(s): ${concerns.slice(0, 3).join("; ")}.`
      : "No security patterns detected in the diff.";

  const finding = { severity, summary };
  await writeAgentMemory("diff", input.author ?? "unknown", finding, input.sha);
  await emitInvestigatorEvent(
    input.deploy_id,
    agent,
    "complete",
    undefined,
    finding
  );

  return { agent, status: "complete", finding };
}
