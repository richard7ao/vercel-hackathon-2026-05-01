import { createAnthropic } from "@ai-sdk/anthropic";
import type { LanguageModel } from "ai";

let provider: ReturnType<typeof createAnthropic> | null = null;

function getProvider() {
  if (!provider) {
    provider = createAnthropic({ apiKey: process.env.CLAUDE_KEY ?? "" });
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
