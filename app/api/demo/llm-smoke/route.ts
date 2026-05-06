import { NextRequest, NextResponse } from "next/server";
import { generateText } from "ai";
import { unauthorizedUnlessDemoBearer } from "@/lib/demo-bearer";
import { getGateway } from "@/lib/ai-gateway";

/**
 * Bearer-gated one-shot LLM check (same auth as other /api/demo/* routes).
 * Verifies AI Gateway or Anthropic path configured on this deployment.
 */
export async function POST(request: NextRequest) {
  const auth = unauthorizedUnlessDemoBearer(request);
  if (auth) return auth;

  const hasAnthropic =
    Boolean(process.env.CLAUDE_KEY?.trim()) ||
    Boolean(process.env.ANTHROPIC_API_KEY?.trim());
  const hasGateway = Boolean(process.env.AI_GATEWAY_API_KEY?.trim());
  if (!hasAnthropic && !hasGateway) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "No LLM credentials: set AI_GATEWAY_API_KEY and/or CLAUDE_KEY (or ANTHROPIC_API_KEY)",
      },
      { status: 503 }
    );
  }

  try {
    const { text } = await generateText({
      model: getGateway().chatModel("anthropic/claude-sonnet-4-6"),
      maxOutputTokens: 24,
      prompt:
        "Reply with exactly the single word OK and no other characters or punctuation.",
    });
    const preview = (text ?? "").trim().slice(0, 80);
    return NextResponse.json({
      ok: true,
      preview,
      llm: hasAnthropic ? "anthropic" : "ai_gateway",
    });
  } catch (err) {
    console.error("[demo/llm-smoke]", err);
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 502 }
    );
  }
}
