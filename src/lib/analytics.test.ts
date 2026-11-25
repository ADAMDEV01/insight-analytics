import { describe, expect, it } from "vitest";
import { isIsoDateString, normalizeDateRange, toIsoDay } from "./analytics";

describe("analytics date utilities", () => {
  it("clamps range length between one and ninety days", () => {
    expect(normalizeDateRange(-5).days).toBe(1);
    expect(normalizeDateRange(1000).days).toBe(90);
    expect(normalizeDateRange(Number.NaN).days).toBe(30);
  });

  it("validates real calendar dates", () => {
    expect(isIsoDateString("2026-02-28")).toBe(true);
    expect(isIsoDateString("2026-02-30")).toBe(false);
    expect(isIsoDateString("2026-13-01")).toBe(false);
  });

  it("normalizes dates to UTC days and rejects invalid dates", () => {
    expect(toIsoDay("2026-01-01T23:00:00-02:00")).toBe("2026-01-02");
    expect(() => toIsoDay("not-a-date")).toThrow("Invalid date");
  });
});
