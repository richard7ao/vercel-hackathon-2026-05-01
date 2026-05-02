import { describe, it, expect } from "vitest";
import { score, compoundBonus, firingTriples, WEIGHTS } from "./score";

describe("score()", () => {
  it.each([
    { input: null },
    { input: {} },
    { input: { structural: null, behavioral: null } },
    { input: { structural: undefined } },
  ])("returns 0 for empty/null input: $input", ({ input }) => {
    expect(score(input)).toBe(0);
  });

  it("returns weighted sum for partial signals", () => {
    const result = score({ structural: 1, behavioral: 0, temporal: 0, compounds: 0 });
    expect(result).toBeCloseTo(WEIGHTS.structural, 5);
  });

  it("returns ~1.0 when all signals are 1", () => {
    const result = score({ structural: 1, behavioral: 1, temporal: 1, compounds: 1 });
    expect(result).toBeCloseTo(1.0, 5);
  });

  it("clamps values above 1 to 1", () => {
    const result = score({ structural: 5, behavioral: 0, temporal: 0, compounds: 0 });
    expect(result).toBeCloseTo(WEIGHTS.structural, 5);
  });

  it("clamps negative values to 0", () => {
    expect(score({ structural: -1, behavioral: 0 })).toBe(0);
  });

  it("treats NaN as 0", () => {
    expect(score({ structural: NaN })).toBe(0);
  });

  it("treats Infinity as 0", () => {
    expect(score({ structural: Infinity })).toBe(0);
  });

  it("computes correct weighted sum for mixed values", () => {
    const result = score({ structural: 0.5, behavioral: 0.5, temporal: 1, compounds: 0 });
    const expected = 0.5 * WEIGHTS.structural + 0.5 * WEIGHTS.behavioral + 1 * WEIGHTS.temporal;
    expect(result).toBeCloseTo(expected, 5);
  });
});

describe("firingTriples()", () => {
  it("returns empty for null signals", () => {
    expect(firingTriples({ signals: null })).toEqual([]);
  });

  it("returns empty when no triple fires", () => {
    expect(firingTriples({ signals: { auth_path: true } })).toEqual([]);
  });

  it("fires AUTH_EXFIL_OFFHOURS when all three keys present", () => {
    const result = firingTriples({
      signals: { auth_path: true, external_fetch: true, off_hours: true },
    });
    expect(result).toContain("AUTH_EXFIL_OFFHOURS");
  });

  it("fires CRITICAL_NOVEL for critical_path + novel_author", () => {
    const result = firingTriples({
      signals: { critical_path: true, novel_author: true },
    });
    expect(result).toContain("CRITICAL_NOVEL");
  });

  it("fires DEP_PAYMENTS for new_dependency + payments_file", () => {
    const result = firingTriples({
      signals: { new_dependency: true, payments_file: true },
    });
    expect(result).toContain("DEP_PAYMENTS");
  });

  it("can fire multiple triples at once", () => {
    const result = firingTriples({
      signals: {
        auth_path: true, external_fetch: true, off_hours: true,
        critical_path: true, novel_author: true,
      },
    });
    expect(result).toEqual(expect.arrayContaining(["AUTH_EXFIL_OFFHOURS", "CRITICAL_NOVEL"]));
  });

  it("does not fire when value is falsy", () => {
    const result = firingTriples({
      signals: { auth_path: false, external_fetch: true, off_hours: true },
    });
    expect(result).not.toContain("AUTH_EXFIL_OFFHOURS");
  });
});

describe("compoundBonus()", () => {
  it("returns 0 when no triples fire", () => {
    expect(compoundBonus({ signals: {} })).toBe(0);
  });

  it("returns 1 when at least one triple fires", () => {
    expect(compoundBonus({
      signals: { critical_path: true, novel_author: true },
    })).toBe(1);
  });
});
