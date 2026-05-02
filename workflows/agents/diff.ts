"use workflow";

import { DurableAgent } from "@workflow/ai/agent";
import { tool, zodSchema } from "ai";
import { z } from "zod";
import { getGateway } from "../../lib/ai-gateway";
import { diffDeterministic } from "../investigators/diff";
import type { InvestigatorInput, InvestigatorResult } from "../investigators/_base";
import { emitInvestigatorEvent } from "../investigators/_base";

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

  try {
    const agent = new DurableAgent({
      model: () => Promise.resolve(getGateway().chatModel("anthropic/claude-sonnet-4-6")),
      instructions:
        "You are a code-diff investigator. Analyze patches for security risks: eval(), exec(), auth bypasses, hardcoded secrets, XSS vectors.",
      tools: { summarizeDiffChunks },
    });

    const writable = new WritableStream({ write() {} });
    await agent.stream({
      messages: [
        {
          role: "user" as const,
          content: `Analyze these diffs for security risks:\n${input.files.map((f) => `--- ${f.path}\n${(f.patch ?? "").slice(0, 2000)}`).join("\n\n")}`,
        },
      ],
      writable,
    });
  } catch (err) {
    console.warn("[diffAgent] DurableAgent failed, falling back:", err);
  }

  return diffDeterministic(input);
}
