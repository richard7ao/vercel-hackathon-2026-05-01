"use step";

import { kv } from "../../lib/db";
import {
  type InvestigatorInput,
  type InvestigatorResult,
  emitInvestigatorEvent,
} from "./_base";

export async function historyInvestigator(
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
      const raw = await kv.get<string[] | string>(
        `history:author:${input.author}`
      );
      if (Array.isArray(raw)) knownDirs = raw;
      else if (typeof raw === "string") knownDirs = JSON.parse(raw);
    } catch {}
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
  for (const file of input.files) {
    try {
      const raw = await kv.get<number[] | string>(
        `history:hour:${file.path}`
      );
      const counts = Array.isArray(raw)
        ? raw
        : typeof raw === "string"
          ? JSON.parse(raw)
          : null;
      if (!counts || counts[hour] === 0) novelHours++;
    } catch {}
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
  await emitInvestigatorEvent(
    input.deploy_id,
    agent,
    "complete",
    undefined,
    finding
  );

  return { agent, status: "complete", finding };
}
