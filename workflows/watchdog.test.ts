import { describe, it, expect } from "vitest";
import {
  validateAckPayload,
  applyAck,
  computeTimeoutAt,
  buildSignalName,
} from "./watchdog-helpers";

describe("buildSignalName()", () => {
  it("produces deploy:ack:<id>", () => {
    expect(buildSignalName("abc123")).toBe("deploy:ack:abc123");
  });

  it("handles empty string", () => {
    expect(buildSignalName("")).toBe("deploy:ack:");
  });
});

describe("validateAckPayload()", () => {
  it.each([
    { label: "ack action", payload: { action_type: "ack", user: { id: "u1", username: "alice" } } },
    { label: "hold action", payload: { action_type: "hold", user: { id: "u1", username: "bob" } } },
    { label: "page action", payload: { action_type: "page", user: { id: "u1", username: "carol" } } },
  ])("accepts $label", ({ payload }) => {
    expect(validateAckPayload(payload)).toBe(true);
  });

  it.each([
    { label: "null", payload: null },
    { label: "non-object", payload: "string" },
    { label: "unknown action_type", payload: { action_type: "unknown", user: { id: "u1", username: "x" } } },
    { label: "missing user", payload: { action_type: "ack" } },
    { label: "user without id", payload: { action_type: "ack", user: { username: "x" } } },
    { label: "empty user id", payload: { action_type: "ack", user: { id: "", username: "x" } } },
    { label: "non-string username", payload: { action_type: "ack", user: { id: "u1", username: 42 } } },
  ])("rejects $label", ({ payload }) => {
    expect(validateAckPayload(payload)).toBe(false);
  });
});

describe("computeTimeoutAt()", () => {
  it("returns ISO string in the future", () => {
    const now = new Date("2026-01-01T00:00:00Z");
    const result = computeTimeoutAt(now);
    const parsed = new Date(result);
    expect(parsed.getTime()).toBeGreaterThan(now.getTime());
  });

  it("defaults to 86400 seconds ahead", () => {
    const now = new Date("2026-01-01T00:00:00Z");
    const result = computeTimeoutAt(now);
    const parsed = new Date(result);
    expect(parsed.getTime() - now.getTime()).toBe(86400 * 1000);
  });
});

describe("applyAck()", () => {
  const user = { id: "u1", username: "alice" };

  it("sets acknowledged_at and acknowledged_by for ack", () => {
    const result = applyAck({}, { action_type: "ack", user });
    expect(result).toHaveProperty("acknowledged_at");
    expect(result.acknowledged_by).toBe("alice");
    expect(result.action_taken).toBe("ack");
  });

  it("sets held_until for hold action", () => {
    const result = applyAck({}, { action_type: "hold", user });
    expect(result).toHaveProperty("held_until");
    expect(result.action_taken).toBe("hold");
  });

  it("sets paged_at for page action", () => {
    const result = applyAck({}, { action_type: "page", user });
    expect(result).toHaveProperty("paged_at");
    expect(result.action_taken).toBe("page");
  });

  it("is idempotent — second call does not overwrite", () => {
    const first = applyAck({}, { action_type: "ack", user });
    const second = applyAck(first, {
      action_type: "hold",
      user: { id: "u2", username: "bob" },
    });
    expect(second.acknowledged_at).toBe(first.acknowledged_at);
    expect(second.acknowledged_by).toBe("alice");
    expect(second).not.toHaveProperty("held_until");
  });

  it("preserves existing fields on the verdict record", () => {
    const result = applyAck(
      { level: "critical", score: 0.9 },
      { action_type: "ack", user },
    );
    expect(result.level).toBe("critical");
    expect(result.score).toBe(0.9);
  });
});
