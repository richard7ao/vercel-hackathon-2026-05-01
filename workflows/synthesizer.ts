"use step";

import { DurableAgent, Output } from "@workflow/ai/agent";
import { z } from "zod";
import { kv } from "../lib/db";
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

  const prompt = `Collapse these inspector findings into a single verdict. Inputs: findings (each: agent, severity, summary), signals (which detectors fired), score (0–1). Output **only valid JSON** matching: { level: "benign|watch|investigate|critical", summary: string, concerns: string[3..6], suggested_action: string }. The level MUST escalate when any finding is "critical". The summary is one sentence. Concerns are 3 to 6 short bullets, each tied to evidence.

Findings: ${JSON.stringify(findings)}
Signals: ${JSON.stringify(signals)}
Score: ${score}`;

  let verdict: Verdict | null = null;

  try {
    const agent = new DurableAgent({
      model: () => Promise.resolve(getGateway().chatModel("anthropic/claude-sonnet-4-6")),
      instructions: "You are a security verdict synthesizer. Analyze inspector findings and produce a structured verdict.",
    });

    const writable = new WritableStream({ write() {} });
    const result = await agent.stream({
      messages: [{ role: "user" as const, content: prompt }],
      writable,
      experimental_output: Output.object({ schema: verdictSchema }),
      maxOutputTokens: 512,
    });

    const parsed = result.experimental_output;
    if (parsed && LEVELS.includes(parsed.level)) {
      verdict = parsed as Verdict;
    }
  } catch (err) {
    console.warn("[synthesizer] DurableAgent failed:", err);
  }

  if (!verdict) {
    verdict = derivedVerdict({ findings, signals, score });
  }

  await kv.set(`verdicts:${deploy_id}`, {
    ...verdict,
    synthesized_at: new Date().toISOString(),
  });

  return verdict;
}
