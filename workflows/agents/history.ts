"use workflow";

import { DurableAgent } from "@workflow/ai/agent";
import { tool, zodSchema } from "ai";
import { z } from "zod";
import { kvGet } from "../steps/kv-ops";
import { getGateway } from "../../lib/ai-gateway";
import { historyDeterministic } from "../investigators/history";
import type { InvestigatorInput, InvestigatorResult } from "../investigators/_base";
import { emitInvestigatorEvent } from "../investigators/_base";

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

const lookupCochangeHistory = tool({
  description: "Look up co-change frequency for a file path",
  inputSchema: zodSchema(z.object({ filePath: z.string() })),
  execute: async ({ filePath }: { filePath: string }) => {
    try {
      const raw = await kvGet<number[] | string>(`history:cochange:${filePath}`);
      if (Array.isArray(raw)) return raw;
      if (typeof raw === "string") return JSON.parse(raw);
    } catch (err) {
      console.warn("[historyAgent] cochange lookup failed:", err);
    }
    return null;
  },
});

export async function historyAgent(
  input: InvestigatorInput
): Promise<InvestigatorResult> {
  await emitInvestigatorEvent(input.deploy_id, "history", "dispatched");

  let agentText = "";
  try {
    const agent = new DurableAgent({
      model: () => Promise.resolve(getGateway().chatModel("anthropic/claude-sonnet-4-6")),
      instructions:
        "You are a commit-history investigator. Analyze whether the commit author is operating outside their usual areas. Use the provided tools to look up author history and co-change patterns. Produce a severity assessment: critical, high, medium, or low.",
      tools: { lookupAuthorHistory, lookupCochangeHistory },
    });

    const writable = new WritableStream({
      write(chunk) { if (typeof chunk === "string") agentText += chunk; },
    });
    await agent.stream({
      messages: [
        {
          role: "user" as const,
          content: `Investigate this commit for history anomalies:\nAuthor: ${input.author ?? "unknown"}\nFiles: ${input.files.map((f) => f.path).join(", ")}\nDeploy: ${input.deploy_id}`,
        },
      ],
      writable,
    });
  } catch (err) {
    console.warn("[historyAgent] DurableAgent failed, falling back:", err);
  }

  if (agentText.length > 20) {
    const severities = ["critical", "high", "medium", "low"] as const;
    const match = severities.find((s) => agentText.toLowerCase().includes(s));
    if (match) {
      const result: InvestigatorResult = {
        agent: "history",
        status: "complete" as const,
        finding: { severity: match, summary: agentText.slice(0, 500).trim() },
      };
      await emitInvestigatorEvent(input.deploy_id, "history", "complete", undefined, result.finding);
      return result;
    }
  }

  const fallback = await historyDeterministic(input);
  await emitInvestigatorEvent(input.deploy_id, "history", fallback.status, undefined, fallback.finding);
  return fallback;
}
