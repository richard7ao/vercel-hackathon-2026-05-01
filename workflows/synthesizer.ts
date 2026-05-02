"use step";

import { generateText } from "ai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { kv } from "../lib/db";

type SynthesizerInput = {
  deploy_id: string;
  findings: { agent: string; severity?: string; summary?: string }[];
  signals: Record<string, unknown>;
  score: number;
};

type Verdict = {
  level: "benign" | "watch" | "investigate" | "critical";
  summary: string;
  concerns: string[];
  suggested_action: string;
};

const LEVELS = ["benign", "watch", "investigate", "critical"] as const;
type Level = (typeof LEVELS)[number];

const SEVERITY_TO_LEVEL: Record<string, Level> = {
  critical: "critical",
  high: "investigate",
  medium: "watch",
  low: "benign",
};

function levelIndex(l: Level): number {
  return LEVELS.indexOf(l);
}

export function escalateLevel(current: string, findingSeverity: string): Level {
  const currentLevel = LEVELS.includes(current as Level)
    ? (current as Level)
    : "benign";
  const findingLevel = SEVERITY_TO_LEVEL[findingSeverity] ?? "benign";
  return levelIndex(currentLevel) >= levelIndex(findingLevel)
    ? currentLevel
    : findingLevel;
}

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

  let scoreFloor: Level = "benign";
  if (score >= 0.8) scoreFloor = "investigate";
  else if (score >= 0.6) scoreFloor = "watch";

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

  const topSummary =
    sorted.length > 0 && sorted[0].summary
      ? `${level.charAt(0).toUpperCase() + level.slice(1)} — ${sorted[0].summary.slice(0, 120)}`
      : `${level.charAt(0).toUpperCase() + level.slice(1)} risk assessment based on score ${(score * 100).toFixed(0)}%.`;

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

export function parseLLMVerdict(raw: string): Verdict | null {
  try {
    let text = raw.trim();
    const fenceMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
    if (fenceMatch) text = fenceMatch[1].trim();
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start === -1 || end === -1) return null;
    text = text.slice(start, end + 1);
    const parsed = JSON.parse(text);
    if (!LEVELS.includes(parsed.level)) return null;
    if (typeof parsed.summary !== "string") return null;
    if (!Array.isArray(parsed.concerns)) return null;
    if (typeof parsed.suggested_action !== "string") return null;
    return parsed as Verdict;
  } catch {
    return null;
  }
}

export async function synthesize(input: SynthesizerInput): Promise<Verdict> {
  const { deploy_id, findings, signals, score } = input;

  const prompt = `Collapse these inspector findings into a single verdict. Inputs: findings (each: agent, severity, summary), signals (which detectors fired), score (0–1). Output **only valid JSON** matching: { level: "benign|watch|investigate|critical", summary: string, concerns: string[3..6], suggested_action: string }. The level MUST escalate when any finding is "critical". The summary is one sentence. Concerns are 3 to 6 short bullets, each tied to evidence.

Findings: ${JSON.stringify(findings)}
Signals: ${JSON.stringify(signals)}
Score: ${score}`;

  let verdict: Verdict | null = null;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const gateway = createOpenAICompatible({
        name: "ai-gateway",
        baseURL: "https://gateway.ai.vercel.app/v1",
        headers: { Authorization: `Bearer ${process.env.AI_GATEWAY_API_KEY}` },
      });
      const { text } = await generateText({
        model: gateway.chatModel("anthropic/claude-sonnet-4-6"),
        prompt,
        temperature: 0,
        maxOutputTokens: 512,
      });
      verdict = parseLLMVerdict(text);
      if (verdict) break;
    } catch {
      // LLM unavailable, will retry or fall back
    }
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
