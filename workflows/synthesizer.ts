"use step";

import { generateObject } from "ai";
import { z } from "zod";
import { redisSet } from "../lib/db-redis";
import { getGateway } from "../lib/ai-gateway";
import { LEVELS } from "../lib/verdict-levels";
import { derivedVerdict, type Verdict } from "./synthesizer-helpers";

const verdictSchema = z.object({
  level: z.enum(LEVELS),
  summary: z.string(),
  concerns: z.array(z.string()).min(3).max(6),
  suggested_action: z.string(),
});

type SynthesizerInput = {
  deploy_id: string;
  findings: { agent: string; severity?: string; summary?: string }[];
  signals: Record<string, unknown>;
  score: number;
};

export async function synthesize(input: SynthesizerInput): Promise<Verdict> {
  const { deploy_id, findings, signals, score } = input;

  let verdict: Verdict | null = null;

  try {
    const { object } = await generateObject({
      model: getGateway().chatModel("anthropic/claude-sonnet-4-6"),
      schema: verdictSchema,
      maxOutputTokens: 512,
      prompt: `You are a security verdict synthesizer. Collapse these inspector findings into a single verdict. The level MUST escalate to "critical" when any finding severity is "critical". The summary is one sentence. Concerns are 3 to 6 short bullets, each tied to evidence from the findings.

Findings: ${JSON.stringify(findings)}
Signals: ${JSON.stringify(signals)}
Score: ${score}`,
    });

    if (object && LEVELS.includes(object.level)) {
      verdict = object as Verdict;
    }
  } catch (err) {
    console.warn("[synthesizer] LLM call failed:", err);
  }

  if (!verdict) {
    verdict = derivedVerdict({ findings, signals, score });
  }

  await redisSet(
    `verdicts:${deploy_id}`,
    JSON.stringify({
      type: "verdict",
      deploy_id,
      ...verdict,
      synthesized_at: new Date().toISOString(),
    })
  );

  return verdict;
}
