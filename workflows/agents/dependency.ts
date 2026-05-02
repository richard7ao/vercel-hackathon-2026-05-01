"use workflow";

import { DurableAgent } from "@workflow/ai/agent";
import { tool, zodSchema } from "ai";
import { z } from "zod";
import { getGateway } from "../../lib/ai-gateway";
import { dependencyDeterministic } from "../investigators/dependency";
import type { InvestigatorInput, InvestigatorResult } from "../investigators/_base";
import { emitInvestigatorEvent } from "../investigators/_base";

const analyzeManifestDelta = tool({
  description: "Analyze the diff of package.json to identify new, removed, or version-changed dependencies",
  inputSchema: zodSchema(z.object({
    files: z.array(z.object({ path: z.string(), patch: z.string().optional() })),
  })),
  execute: async ({ files }: { files: { path: string; patch?: string }[] }) => {
    const pkgFile = files.find((f) => f.path === "package.json");
    if (!pkgFile?.patch) return { newDeps: [] as string[], removedDeps: [] as string[], changed: false };
    const addedLines = pkgFile.patch
      .split("\n")
      .filter((l) => l.startsWith("+") && l.includes('"'))
      .map((l) => l.slice(1).trim());
    return { newDeps: addedLines, removedDeps: [] as string[], changed: true };
  },
});

export async function dependencyAgent(
  input: InvestigatorInput
): Promise<InvestigatorResult> {
  await emitInvestigatorEvent(input.deploy_id, "dependency", "dispatched");

  let agentText = "";
  try {
    const agent = new DurableAgent({
      model: () => Promise.resolve(getGateway().chatModel("anthropic/claude-sonnet-4-6")),
      instructions:
        "You are a dependency investigator. Analyze package.json changes to identify supply-chain risks from new or modified dependencies. Produce a severity assessment: critical, high, medium, or low.",
      tools: { analyzeManifestDelta },
    });

    const writable = new WritableStream({
      write(chunk) { if (typeof chunk === "string") agentText += chunk; },
    });
    await agent.stream({
      messages: [
        {
          role: "user" as const,
          content: `Investigate dependency changes in this commit:\nFiles: ${input.files.map((f) => f.path).join(", ")}\nDeploy: ${input.deploy_id}`,
        },
      ],
      writable,
    });
  } catch (err) {
    console.warn("[dependencyAgent] DurableAgent failed, falling back:", err);
  }

  if (agentText.length > 20) {
    const severities = ["critical", "high", "medium", "low"] as const;
    const match = severities.find((s) => agentText.toLowerCase().includes(s));
    if (match) {
      const result: InvestigatorResult = {
        agent: "dependency",
        status: "complete" as const,
        finding: { severity: match, summary: agentText.slice(0, 500).trim() },
      };
      await emitInvestigatorEvent(input.deploy_id, "dependency", "complete", undefined, result.finding);
      return result;
    }
  }

  const fallback = await dependencyDeterministic(input);
  await emitInvestigatorEvent(input.deploy_id, "dependency", fallback.status, undefined, fallback.finding);
  return fallback;
}
