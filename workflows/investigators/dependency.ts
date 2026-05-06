"use step";

import {
  type InvestigatorInput,
  type InvestigatorResult,
  emitInvestigatorEvent,
  writeAgentMemory,
} from "./_base";
import { detectNewDependency } from "../../lib/signals/structural";

export { dependencyDeterministic as dependencyInvestigator };

export async function dependencyDeterministic(
  input: InvestigatorInput
): Promise<InvestigatorResult> {
  const agent = "dependency";
  await emitInvestigatorEvent(input.deploy_id, agent, "dispatched");

  const pkgFile = input.files.find((f) => f.path === "package.json");
  if (!pkgFile?.patch) {
    const finding = {
      severity: "low" as const,
      summary: "No package.json changes detected.",
    };
    await emitInvestigatorEvent(
      input.deploy_id,
      agent,
      "complete",
      undefined,
      finding
    );
    return { agent, status: "complete", finding };
  }

  await emitInvestigatorEvent(
    input.deploy_id,
    agent,
    "investigating",
    "parsing new dependencies"
  );

  const depResult = detectNewDependency(pkgFile);
  const newDeps = depResult.evidence;

  if (newDeps.length === 0) {
    const finding = {
      severity: "low" as const,
      summary: "package.json modified but no new dependencies added.",
    };
    await emitInvestigatorEvent(
      input.deploy_id,
      agent,
      "complete",
      undefined,
      finding
    );
    return { agent, status: "complete", finding };
  }

  await emitInvestigatorEvent(
    input.deploy_id,
    agent,
    "investigating",
    `analyzing ${newDeps.length} new dep(s)`
  );

  const depNames = newDeps.map((d) => `${d.name}@${d.version}`).join(", ");
  const hasCriticalPath = input.files.some(
    (f) =>
      f.path.includes("payment") ||
      f.path.includes("billing") ||
      f.path.includes("auth")
  );

  const severity = hasCriticalPath
    ? ("high" as const)
    : newDeps.length >= 3
      ? ("high" as const)
      : ("medium" as const);

  const summary = `${newDeps.length} new dependency(ies) added: ${depNames}.${hasCriticalPath ? " In critical payment/auth path." : ""}`;

  const finding = { severity, summary };
  await writeAgentMemory("dependency", input.author ?? "unknown", finding, input.sha);
  await emitInvestigatorEvent(
    input.deploy_id,
    agent,
    "complete",
    undefined,
    finding
  );

  return { agent, status: "complete", finding };
}
