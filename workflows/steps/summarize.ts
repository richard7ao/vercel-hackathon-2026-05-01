"use step";

import { generateText } from "ai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { setDeploy, getDeploy } from "../../lib/db";

const gateway = createOpenAICompatible({
  name: "vercel-ai-gateway",
  baseURL: "https://gateway.ai.vercel.app/v1",
  headers: {
    Authorization: `Bearer ${process.env.AI_GATEWAY_API_KEY ?? ""}`,
  },
});

type SummarizeInput = {
  files: { path: string; patch: string }[];
  commit_message: string;
  sha?: string;
};

function mockTldr(input: SummarizeInput): string {
  const paths = input.files.map((f) => f.path).join(", ");
  return `Modified ${paths}. ${input.commit_message}.`;
}

export async function summarize(
  input: SummarizeInput
): Promise<{ tldr: string }> {
  const diff = input.files
    .map((f) => `--- ${f.path}\n${f.patch}`)
    .join("\n\n")
    .slice(0, 4000);

  let tldr: string;

  try {
    const { text } = await generateText({
      model: gateway.chatModel("anthropic/claude-sonnet-4-6"),
      prompt: `Summarize this code change in exactly 2 sentences. First sentence: what changed. Second sentence: the most likely intent.\n\nCommit message: ${input.commit_message}\n\n<diff>\n${diff}\n</diff>`,
      maxOutputTokens: 150,
    });
    tldr = text.trim();
  } catch {
    tldr = mockTldr(input);
  }

  if (input.sha) {
    try {
      const existing = await getDeploy(input.sha);
      if (existing) {
        await setDeploy(input.sha, { ...existing, tldr });
      }
    } catch {
      // KV unavailable
    }
  }

  return { tldr };
}
