import { describe, it, expect } from "vitest";
import { derivedVerdict } from "./synthesizer-helpers";

describe("derivedVerdict()", () => {
  it.each([
    {
      label: "critical finding → critical",
      findings: [{ agent: "h", severity: "critical", summary: "auth bypass" }],
      score: 0.3,
      expectedLevel: "critical",
    },
    {
      label: "high finding → investigate",
      findings: [{ agent: "h", severity: "high", summary: "risky change" }],
      score: 0.3,
      expectedLevel: "investigate",
    },
    {
      label: "medium finding → watch",
      findings: [{ agent: "h", severity: "medium", summary: "minor concern" }],
      score: 0.3,
      expectedLevel: "watch",
    },
    {
      label: "low finding → benign",
      findings: [{ agent: "h", severity: "low", summary: "trivial" }],
      score: 0.3,
      expectedLevel: "benign",
    },
    {
      label: "no findings, high score → investigate",
      findings: [],
      score: 0.85,
      expectedLevel: "investigate",
    },
    {
      label: "no findings, medium score → watch",
      findings: [],
      score: 0.65,
      expectedLevel: "watch",
    },
    {
      label: "no findings, low score → benign",
      findings: [],
      score: 0.1,
      expectedLevel: "benign",
    },
    {
      label: "score floor overrides low finding",
      findings: [{ agent: "d", severity: "low", summary: "trivial" }],
      score: 0.9,
      expectedLevel: "investigate",
    },
    {
      label: "critical finding overrides low score floor",
      findings: [{ agent: "d", severity: "critical", summary: "critical vuln" }],
      score: 0.1,
      expectedLevel: "critical",
    },
  ])("$label", ({ findings, score, expectedLevel }) => {
    const v = derivedVerdict({ findings, signals: {}, score });
    expect(v.level).toBe(expectedLevel);
  });

  it("produces 3-6 concerns", () => {
    const v = derivedVerdict({
      findings: [
        { agent: "a", severity: "high", summary: "s1" },
        { agent: "b", severity: "medium", summary: "s2" },
      ],
      signals: {},
      score: 0.7,
    });
    expect(v.concerns.length).toBeGreaterThanOrEqual(3);
    expect(v.concerns.length).toBeLessThanOrEqual(6);
  });

  it("pads concerns to at least 3 when findings are sparse", () => {
    const v = derivedVerdict({
      findings: [{ agent: "a", severity: "low", summary: "one" }],
      signals: {},
      score: 0.5,
    });
    expect(v.concerns.length).toBe(3);
  });

  it("caps concerns at 6 even with many findings", () => {
    const findings = Array.from({ length: 10 }, (_, i) => ({
      agent: `a${i}`,
      severity: "high",
      summary: `finding ${i}`,
    }));
    const v = derivedVerdict({ findings, signals: {}, score: 0.9 });
    expect(v.concerns.length).toBeLessThanOrEqual(6);
  });

  it("sorts concerns by severity (highest first)", () => {
    const v = derivedVerdict({
      findings: [
        { agent: "a", severity: "low", summary: "low issue" },
        { agent: "b", severity: "critical", summary: "critical issue" },
        { agent: "c", severity: "medium", summary: "medium issue" },
      ],
      signals: {},
      score: 0.5,
    });
    expect(v.concerns[0]).toBe("critical issue");
  });

  it("summary starts with capitalized level label", () => {
    const v = derivedVerdict({
      findings: [{ agent: "a", severity: "critical", summary: "auth flaw" }],
      signals: {},
      score: 0.9,
    });
    expect(v.summary).toMatch(/^Critical/);
  });

  it("returns appropriate suggested_action per level", () => {
    const critical = derivedVerdict({
      findings: [{ agent: "a", severity: "critical", summary: "s" }],
      signals: {},
      score: 0.9,
    });
    expect(critical.suggested_action).toContain("Pause");

    const benign = derivedVerdict({ findings: [], signals: {}, score: 0.1 });
    expect(benign.suggested_action).toContain("No action");
  });

  it("handles missing severity gracefully (defaults to low)", () => {
    const v = derivedVerdict({
      findings: [{ agent: "a", summary: "no severity" }],
      signals: {},
      score: 0.1,
    });
    expect(v.level).toBe("benign");
  });
});
