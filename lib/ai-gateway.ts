import { createAnthropic } from "@ai-sdk/anthropic";
import type { LanguageModel } from "ai";

/**
 * Live LLM calls (summarizer, investigators, synthesizer) use the Anthropic API.
 * Prefer `CLAUDE_KEY`; fall back to `ANTHROPIC_API_KEY` so local/Vercel tooling can
 * reuse either convention. Set `CLAUDE_KEY` in Vercel project env for production.
 */
function anthropicApiKey(): string {
  const k =
    process.env.CLAUDE_KEY?.trim() ||
    process.env.ANTHROPIC_API_KEY?.trim() ||
    "";
  return k;
}

let provider: ReturnType<typeof createAnthropic> | null = null;
let providerForKey: string | null = null;

function getProvider() {
  const apiKey = anthropicApiKey();
  if (!provider || providerForKey !== apiKey) {
    provider = createAnthropic({ apiKey });
    providerForKey = apiKey;
  }
  return provider;
}

const MODEL_MAP: Record<string, string> = {
  "anthropic/claude-sonnet-4-6": "claude-haiku-4-5-20251001",
  "anthropic/claude-haiku-4-5": "claude-haiku-4-5-20251001",
};

export function getGateway() {
  return {
    chatModel(modelId: string): LanguageModel {
      const mapped = MODEL_MAP[modelId] ?? modelId.replace("anthropic/", "");
      return getProvider().chat(mapped);
    },
  };
}
