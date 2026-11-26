import { describe, expect, it } from "vitest";
import { buildDailySeries, isIsoDateString, normalizeDateRange, toIsoDay } from "./analytics";

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

  it("fills missing days with zeros and merges daily aggregates", () => {
    expect(buildDailySeries(
      "2026-02-27",
      4,
      [
        { day: "2026-02-27", events: 12 },
        { day: "2026-03-01", events: 3 },
      ],
      [
        { day: "2026-02-27", users: 5 },
        { day: "2026-03-02", users: 2 },
      ],
    )).toEqual([
      { day: "2026-02-27", events: 12, activeUsers: 5 },
      { day: "2026-02-28", events: 0, activeUsers: 0 },
      { day: "2026-03-01", events: 3, activeUsers: 0 },
      { day: "2026-03-02", events: 0, activeUsers: 2 },
    ]);
  });

  it("rejects an invalid time-series start date", () => {
    expect(() => buildDailySeries("2026-02-30", 7, [], [])).toThrow("Invalid series start date");
  });
});
