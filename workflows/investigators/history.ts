"use step";

import { redisGet } from "../../lib/db-redis";
import {
  type InvestigatorInput,
  type InvestigatorResult,
  emitInvestigatorEvent,
  writeAgentMemory,
} from "./_base";

export { historyDeterministic as historyInvestigator };

export async function historyDeterministic(
  input: InvestigatorInput
): Promise<InvestigatorResult> {
  const agent = "history";
  await emitInvestigatorEvent(input.deploy_id, agent, "dispatched");

  await emitInvestigatorEvent(
    input.deploy_id,
    agent,
    "investigating",
    "checking author history"
  );

  let knownDirs: string[] = [];
  if (input.author) {
    try {
      const rawStr = await redisGet(`history:author:${input.author}`);
      if (rawStr) {
        const parsed = JSON.parse(rawStr);
        if (Array.isArray(parsed)) knownDirs = parsed;
      }
    } catch (err) {
      console.warn("[history] author lookup failed:", err);
    }
  }

  const touchedDirs = [
    ...new Set(
      input.files.map((f) => f.path.split("/").slice(0, -1).join("/"))
    ),
  ];
  const novelDirs = touchedDirs.filter(
    (d) => !knownDirs.some((k) => d.startsWith(k))
  );

  await emitInvestigatorEvent(
    input.deploy_id,
    agent,
    "investigating",
    "checking hour patterns"
  );

  let novelHours = 0;
  const hour = new Date().getUTCHours();
  const hourResults = await Promise.all(
    input.files.map((file) =>
      redisGet(`history:hour:${file.path}`).catch(() => null)
    )
  );
  for (const rawStr of hourResults) {
    const counts = rawStr ? JSON.parse(rawStr) : null;
    if (!Array.isArray(counts) || counts[hour] === 0) novelHours++;
  }

  let severity: "low" | "medium" | "high" | "critical" = "low";
  const concerns: string[] = [];

  if (novelDirs.length > 0) {
    concerns.push(
      `Author ${input.author ?? "unknown"} has no history in: ${novelDirs.join(", ")}`
    );
    severity = novelDirs.length >= 2 ? "critical" : "high";
  }

  if (novelHours > 0) {
    concerns.push(`${novelHours} file(s) never modified at hour ${hour} UTC`);
    if (severity === "low") severity = "medium";
  }

  if (knownDirs.length === 0 && input.author) {
    concerns.push(`No prior history found for author ${input.author}`);
    if (severity === "low") severity = "high";
  }

  const summary =
    concerns.length > 0
      ? concerns.join(". ") + "."
      : `Author ${input.author ?? "unknown"} is operating in familiar territory.`;

  const finding = { severity, summary };
  await writeAgentMemory("history", input.author ?? "unknown", finding, input.sha);
  await emitInvestigatorEvent(
    input.deploy_id,
    agent,
    "complete",
    undefined,
    finding
  );

  return { agent, status: "complete", finding };
}
