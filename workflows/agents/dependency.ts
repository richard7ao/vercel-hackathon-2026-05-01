"use workflow";

import { fetch } from "workflow";
import { generateText, tool, zodSchema, stepCountIs } from "ai";
import { z } from "zod";
import { getGateway } from "../../lib/ai-gateway";

globalThis.fetch = fetch;
import { dependencyDeterministic } from "../investigators/dependency";
import type { InvestigatorInput, InvestigatorResult } from "../investigators/_base";
import {
  emitInvestigatorEvent,
  readAgentMemory,
  writeAgentMemory,
  formatMemoryContext,
} from "../investigators/_base";

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
  await emitInvestigatorEvent(input.deploy_id, "dependency", "investigating", "analyzing dependencies");

  const author = input.author ?? "unknown";
  const pastMemory = await readAgentMemory("dependency", author);
  const memoryContext = formatMemoryContext(pastMemory);

  try {
    const { text } = await generateText({
      model: getGateway().chatModel("anthropic/claude-sonnet-4-6"),
      tools: { analyzeManifestDelta },
      stopWhen: stepCountIs(3),
      maxOutputTokens: 300,
      prompt: `You are a dependency investigator. Analyze package.json changes to identify supply-chain risks from new or modified dependencies. Use the tool to extract dependency changes. End with exactly one of: SEVERITY:critical, SEVERITY:high, SEVERITY:medium, or SEVERITY:low on its own line.

Files changed: ${input.files.map((f) => f.path).join(", ")}
Patches:
${input.files.filter((f) => f.path.includes("package")).map((f) => `--- ${f.path}\n${(f.patch ?? "").slice(0, 3000)}`).join("\n\n")}${memoryContext}`,
    });

    const severities = ["critical", "high", "medium", "low"] as const;
    const match = severities.find((s) => text.toLowerCase().includes(`severity:${s}`));
    if (match && text.length > 10) {
      const summary = text.replace(/SEVERITY:\w+/gi, "").trim().slice(0, 500);
      const finding = { severity: match, summary };
      await writeAgentMemory("dependency", author, finding, input.sha);
      await emitInvestigatorEvent(input.deploy_id, "dependency", "complete", undefined, finding);
      return { agent: "dependency", status: "complete", finding };
    }
  } catch (err) {
    console.warn("[dependencyAgent] LLM call failed, falling back:", err);
  }

  const fallback = await dependencyDeterministic(input);
  if (fallback.finding) {
    await writeAgentMemory("dependency", author, fallback.finding, input.sha);
  }
  await emitInvestigatorEvent(input.deploy_id, "dependency", fallback.status, undefined, fallback.finding);
  return fallback;
}
