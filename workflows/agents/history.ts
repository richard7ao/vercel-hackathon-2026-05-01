"use workflow";

import { DurableAgent } from "@workflow/ai/agent";
import { tool, zodSchema } from "ai";
import { z } from "zod";
import { kv } from "../../lib/db";
import { getGateway } from "../../lib/ai-gateway";
import { historyDeterministic } from "../investigators/history";
import type { InvestigatorInput, InvestigatorResult } from "../investigators/_base";
import { emitInvestigatorEvent } from "../investigators/_base";

const lookupAuthorHistory = tool({
  description: "Look up known directories for the commit author",
  inputSchema: zodSchema(z.object({ author: z.string() })),
  execute: async ({ author }: { author: string }) => {
    try {
      const raw = await kv.get<string[] | string>(`history:author:${author}`);
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
      const raw = await kv.get<number[] | string>(`history:cochange:${filePath}`);
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

  try {
    const agent = new DurableAgent({
      model: () => Promise.resolve(getGateway().chatModel("anthropic/claude-sonnet-4-6")),
      instructions:
        "You are a commit-history investigator. Analyze whether the commit author is operating outside their usual areas. Use the provided tools to look up author history and co-change patterns. Produce a severity assessment.",
      tools: { lookupAuthorHistory, lookupCochangeHistory },
    });

    const writable = new WritableStream({ write() {} });
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

  return historyDeterministic(input);
}
