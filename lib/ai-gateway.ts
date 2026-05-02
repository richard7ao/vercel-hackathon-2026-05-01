import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

let instance: ReturnType<typeof createOpenAICompatible> | null = null;

export function getGateway() {
  if (!instance) {
    instance = createOpenAICompatible({
      name: "vercel-ai-gateway",
      baseURL: "https://gateway.ai.vercel.app/v1",
      headers: {
        Authorization: `Bearer ${process.env.AI_GATEWAY_API_KEY ?? ""}`,
      },
    });
  }
  return instance;
}
