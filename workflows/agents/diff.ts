"use workflow";

import { fetch } from "workflow";
import { generateText, tool, zodSchema, stepCountIs } from "ai";
import { z } from "zod";
import { getGateway } from "../../lib/ai-gateway";

globalThis.fetch = fetch;
import { diffDeterministic } from "../investigators/diff";
import type { InvestigatorInput, InvestigatorResult } from "../investigators/_base";
import {
  emitInvestigatorEvent,
  readAgentMemory,
  writeAgentMemory,
  formatMemoryContext,
} from "../investigators/_base";

const summarizeDiffChunks = tool({
  description: "Summarize code diff chunks and identify security-relevant patterns",
  inputSchema: zodSchema(z.object({
    files: z.array(z.object({ path: z.string(), patch: z.string().optional() })),
  })),
  execute: async ({ files }: { files: { path: string; patch?: string }[] }) => {
    const chunks = files
      .filter((f) => f.patch)
      .map((f) => ({
        path: f.path,
        addedLines: f.patch!.split("\n").filter((l) => l.startsWith("+")).length,
      }));
    return { fileCount: chunks.length, chunks };
  },
});

export async function diffAgent(
  input: InvestigatorInput
): Promise<InvestigatorResult> {
  await emitInvestigatorEvent(input.deploy_id, "diff", "dispatched");
  await emitInvestigatorEvent(input.deploy_id, "diff", "investigating", "analyzing code diffs");

  const author = input.author ?? "unknown";
  const pastMemory = await readAgentMemory("diff", author);
  const memoryContext = formatMemoryContext(pastMemory);

  try {
    const { text } = await generateText({
      model: getGateway().chatModel("anthropic/claude-sonnet-4-6"),
      tools: { summarizeDiffChunks },
      stopWhen: stepCountIs(3),
      maxOutputTokens: 300,
      prompt: `You are a code-diff investigator. Analyze these patches for security risks: eval(), exec(), auth bypasses, hardcoded secrets, XSS vectors. Use the tool to summarize diff chunks if needed. End with exactly one of: SEVERITY:critical, SEVERITY:high, SEVERITY:medium, or SEVERITY:low on its own line.

${input.files.map((f) => `--- ${f.path}\n${(f.patch ?? "").slice(0, 2000)}`).join("\n\n")}${memoryContext}`,
    });

    const severities = ["critical", "high", "medium", "low"] as const;
    const match = severities.find((s) => text.toLowerCase().includes(`severity:${s}`));
    if (match && text.length > 10) {
      const summary = text.replace(/SEVERITY:\w+/gi, "").trim().slice(0, 500);
      const finding = { severity: match, summary };
      await writeAgentMemory("diff", author, finding, input.sha);
      await emitInvestigatorEvent(input.deploy_id, "diff", "complete", undefined, finding);
      return { agent: "diff", status: "complete", finding };
    }
  } catch (err) {
    console.warn("[diffAgent] LLM call failed, falling back:", err);
  }

  const fallback = await diffDeterministic(input);
  if (fallback.finding) {
    await writeAgentMemory("diff", author, fallback.finding, input.sha);
  }
  await emitInvestigatorEvent(input.deploy_id, "diff", fallback.status, undefined, fallback.finding);
  return fallback;
}
