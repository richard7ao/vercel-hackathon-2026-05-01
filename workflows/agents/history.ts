"use workflow";

import { fetch } from "workflow";
import { generateText, tool, zodSchema, stepCountIs } from "ai";
import { z } from "zod";
import { kvGet } from "../steps/kv-ops";

globalThis.fetch = fetch;
import { getGateway } from "../../lib/ai-gateway";
import { historyDeterministic } from "../investigators/history";
import type { InvestigatorInput, InvestigatorResult } from "../investigators/_base";
import {
  emitInvestigatorEvent,
  readAgentMemory,
  writeAgentMemory,
  formatMemoryContext,
} from "../investigators/_base";

const lookupAuthorHistory = tool({
  description: "Look up known directories for the commit author",
  inputSchema: zodSchema(z.object({ author: z.string() })),
  execute: async ({ author }: { author: string }) => {
    try {
      const raw = await kvGet<string[] | string>(`history:author:${author}`);
      if (Array.isArray(raw)) return raw;
      if (typeof raw === "string") return JSON.parse(raw);
    } catch (err) {
      console.warn("[historyAgent] author lookup failed:", err);
    }
    return [] as string[];
  },
});

const lookupHourHistory = tool({
  description: "Look up hour-of-day edit frequency for a file path",
  inputSchema: zodSchema(z.object({ filePath: z.string() })),
  execute: async ({ filePath }: { filePath: string }) => {
    try {
      const raw = await kvGet<number[] | string>(`history:hour:${filePath}`);
      if (Array.isArray(raw)) return raw;
      if (typeof raw === "string") return JSON.parse(raw);
    } catch (err) {
      console.warn("[historyAgent] hour lookup failed:", err);
    }
    return null;
  },
});

export async function historyAgent(
  input: InvestigatorInput
): Promise<InvestigatorResult> {
  await emitInvestigatorEvent(input.deploy_id, "history", "dispatched");
  await emitInvestigatorEvent(input.deploy_id, "history", "investigating", "analyzing author history");

  const author = input.author ?? "unknown";
  const pastMemory = await readAgentMemory("history", author);
  const memoryContext = formatMemoryContext(pastMemory);

  try {
    const { text } = await generateText({
      model: getGateway().chatModel("anthropic/claude-sonnet-4-6"),
      tools: { lookupAuthorHistory, lookupHourHistory },
      stopWhen: stepCountIs(3),
      maxOutputTokens: 300,
      prompt: `You are a commit-history investigator. Analyze whether this author is operating outside their usual areas or at unusual hours. Use the tools to check. End with exactly one of: SEVERITY:critical, SEVERITY:high, SEVERITY:medium, or SEVERITY:low on its own line.

Author: ${author}
Files: ${input.files.map((f) => f.path).join(", ")}
Current UTC hour: ${new Date().getUTCHours()}${memoryContext}`,
    });

    const severities = ["critical", "high", "medium", "low"] as const;
    const match = severities.find((s) => text.toLowerCase().includes(`severity:${s}`));
    if (match && text.length > 10) {
      const summary = text.replace(/SEVERITY:\w+/gi, "").trim().slice(0, 500);
      const finding = { severity: match, summary };
      await writeAgentMemory("history", author, finding, input.sha);
      await emitInvestigatorEvent(input.deploy_id, "history", "complete", undefined, finding);
      return { agent: "history", status: "complete", finding };
    }
  } catch (err) {
    console.warn("[historyAgent] LLM call failed, falling back:", err);
  }

  const fallback = await historyDeterministic(input);
  if (fallback.finding) {
    await writeAgentMemory("history", author, fallback.finding, input.sha);
  }
  await emitInvestigatorEvent(input.deploy_id, "history", fallback.status, undefined, fallback.finding);
  return fallback;
}
