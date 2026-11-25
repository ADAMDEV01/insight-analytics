import { describe, expect, it } from "vitest";
import { computeFunnel } from "./funnel";

describe("computeFunnel", () => {
  it("counts only users who reached each step in chronological order", () => {
    const result = computeFunnel([
      { distinctId: "a", eventName: "view", occurredAt: "2026-01-01T10:00:00Z" },
      { distinctId: "a", eventName: "signup", occurredAt: "2026-01-01T10:01:00Z" },
      { distinctId: "a", eventName: "purchase", occurredAt: "2026-01-01T10:02:00Z" },
      { distinctId: "b", eventName: "view", occurredAt: "2026-01-01T10:00:00Z" },
      { distinctId: "b", eventName: "purchase", occurredAt: "2026-01-01T10:01:00Z" },
      { distinctId: "c", eventName: "signup", occurredAt: "2026-01-01T10:00:00Z" },
    ], ["view", "signup", "purchase"]);
    expect(result.map((step) => step.users)).toEqual([2, 1, 1]);
    expect(result[1].conversionFromPrevious).toBe(50);
  });
  it("rejects invalid funnel sizes", () => {
    expect(() => computeFunnel([], ["only-one"])).toThrow();
    expect(() => computeFunnel([], Array.from({ length: 9 }, (_, index) => "step-" + index))).toThrow();
  });
});
