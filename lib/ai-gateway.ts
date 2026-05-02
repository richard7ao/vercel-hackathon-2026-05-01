import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { LanguageModel } from "ai";

/**
 * Read env at runtime (bracket form) so workflow step bundles are less likely to
 * inline missing build-time values for secrets.
 */
function env(name: string): string {
  if (typeof process === "undefined") return "";
  const v = process.env[name];
  return typeof v === "string" ? v.trim() : "";
}

/**
 * Live LLM calls use, in order:
 * 1. Direct Anthropic when `CLAUDE_KEY` or `ANTHROPIC_API_KEY` is set.
 * 2. Vercel AI Gateway when `AI_GATEWAY_API_KEY` is set (track-aligned).
 *
 * If you only set `AI_GATEWAY_API_KEY`, the old code path ignored it entirely —
 * workflows looked only for Anthropic keys, so your Anthropic key looked "unused."
 */
function anthropicApiKey(): string {
  return env("CLAUDE_KEY") || env("ANTHROPIC_API_KEY") || "";
}

function gatewayApiKey(): string {
  return env("AI_GATEWAY_API_KEY");
}

type GatewayProvider = ReturnType<typeof createOpenAICompatible>;
type AnthropicProvider = ReturnType<typeof createAnthropic>;

let gatewayProvider: GatewayProvider | null = null;
let gatewayForKey: string | null = null;

let anthropicProvider: AnthropicProvider | null = null;
let anthropicForKey: string | null = null;

function getGatewayProvider(): GatewayProvider {
  const apiKey = gatewayApiKey();
  if (!gatewayProvider || gatewayForKey !== apiKey) {
    gatewayProvider = createOpenAICompatible({
      name: "vercel-ai-gateway",
      baseURL: "https://gateway.ai.vercel.app/v1",
      apiKey,
    });
    gatewayForKey = apiKey;
  }
  return gatewayProvider;
}

function getAnthropicProvider(): AnthropicProvider {
  const apiKey = anthropicApiKey();
  if (!anthropicProvider || anthropicForKey !== apiKey) {
    anthropicProvider = createAnthropic({ apiKey });
    anthropicForKey = apiKey;
  }
  return anthropicProvider;
}

const MODEL_MAP: Record<string, string> = {
  "anthropic/claude-sonnet-4-6": "claude-haiku-4-5-20251001",
  "anthropic/claude-haiku-4-5": "claude-haiku-4-5-20251001",
};

export function getGateway() {
  return {
    chatModel(modelId: string): LanguageModel {
      const directKey = anthropicApiKey();
      if (directKey) {
        const mapped =
          MODEL_MAP[modelId] ?? modelId.replace("anthropic/", "");
        return getAnthropicProvider().chat(mapped);
      }
      return getGatewayProvider().chatModel(modelId);
    },
  };
}
