"use step";

import { DurableAgent, Output } from "@workflow/ai/agent";
import { z } from "zod";
import { kv } from "../lib/db";
import { getGateway } from "../lib/ai-gateway";
import {
  LEVELS,
  type Level,
  SEVERITY_TO_LEVEL,
  levelIndex,
} from "../lib/verdict-levels";

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

type Verdict = {
  level: Level;
  summary: string;
  concerns: string[];
  suggested_action: string;
};

export function derivedVerdict(input: {
  findings: { agent?: string; severity?: string; summary?: string }[];
  signals: Record<string, unknown>;
  score: number;
}): Verdict {
  const { findings, score } = input;

  let findingLevel: Level = "benign";
  for (const f of findings) {
    const mapped = SEVERITY_TO_LEVEL[f.severity ?? "low"] ?? "benign";
    if (levelIndex(mapped) > levelIndex(findingLevel)) {
      findingLevel = mapped;
    }
  }

  const scoreFloor: Level =
    score >= 0.8 ? "investigate" : score >= 0.6 ? "watch" : "benign";

  const level =
    levelIndex(findingLevel) >= levelIndex(scoreFloor)
      ? findingLevel
      : scoreFloor;

  const sorted = [...findings].sort((a, b) => {
    const aIdx = levelIndex(SEVERITY_TO_LEVEL[a.severity ?? "low"] ?? "benign");
    const bIdx = levelIndex(SEVERITY_TO_LEVEL[b.severity ?? "low"] ?? "benign");
    return bIdx - aIdx;
  });

  const concerns: string[] = [];
  for (const f of sorted) {
    if (concerns.length >= 6) break;
    if (f.summary) concerns.push(f.summary);
  }
  if (concerns.length < 3) {
    if (score > 0) concerns.push(`Risk score: ${(score * 100).toFixed(0)}%`);
    if (concerns.length < 3) concerns.push("Review recommended before merge.");
    if (concerns.length < 3) concerns.push("No additional context available.");
  }

  const label = level.charAt(0).toUpperCase() + level.slice(1);
  const topSummary =
    sorted.length > 0 && sorted[0].summary
      ? `${label} — ${sorted[0].summary.slice(0, 120)}`
      : `${label} risk assessment based on score ${(score * 100).toFixed(0)}%.`;

  const actions: Record<Level, string> = {
    critical:
      "Pause deployment immediately and escalate to security team for review.",
    investigate:
      "Hold deployment for manual review before promoting to production.",
    watch: "Proceed with caution; monitor post-deploy metrics closely.",
    benign: "No action required — deploy appears safe.",
  };

  return {
    level,
    summary: topSummary,
    concerns,
    suggested_action: actions[level],
  };
}

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
