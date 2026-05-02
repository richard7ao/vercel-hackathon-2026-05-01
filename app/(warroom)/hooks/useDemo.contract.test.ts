import { describe, it, expect } from "vitest";
import { computeLoopState } from "./useDemo";

/** CLAUDE.md: demo auto-runs on first paint (3-second calm hold, then play). */
describe("computeLoopState initial hold (CLAUDE demo contract)", () => {
  it("stays playing-pending until 3000ms then playing", () => {
    expect(
      computeLoopState({ phase: "initial", mode: "demo", sinceMs: 0 })
    ).toBe("playing-pending");
    expect(
      computeLoopState({ phase: "initial", mode: "demo", sinceMs: 2999 })
    ).toBe("playing-pending");
    expect(
      computeLoopState({ phase: "initial", mode: "demo", sinceMs: 3000 })
    ).toBe("playing");
  });
});
