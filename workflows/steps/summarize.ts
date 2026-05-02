"use step";

import { generateText } from "ai";
import { redisGet, redisSet } from "../../lib/db-redis";
import { getGateway } from "../../lib/ai-gateway";

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
      model: getGateway().chatModel("anthropic/claude-sonnet-4-6"),
      prompt: `Summarize this code change in exactly 2 sentences. First sentence: what changed. Second sentence: the most likely intent.\n\nCommit message: ${input.commit_message}\n\n<diff>\n${diff}\n</diff>`,
      maxOutputTokens: 150,
    });
    tldr = text.trim();
  } catch (err) {
    console.warn("[summarize] AI Gateway failed, using mock:", err);
    tldr = mockTldr(input);
  }

  if (input.sha) {
    try {
      const raw = await redisGet(`deploys:${input.sha}`);
      if (raw) {
        const existing = JSON.parse(raw) as Record<string, unknown>;
        await redisSet(
          `deploys:${input.sha}`,
          JSON.stringify({ ...existing, tldr })
        );
      }
    } catch (err) {
      console.warn("[summarize] KV update failed:", err);
    }
  }

  return { tldr };
}
