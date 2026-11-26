import { describe, expect, it } from "vitest";
import { parseContentLength } from "./content-length";

describe("parseContentLength", () => {
  it("distinguishes an absent header from a valid zero-byte body", () => {
    expect(parseContentLength(null)).toBeUndefined();
    expect(parseContentLength("0")).toBe(0);
  });

  it("accepts ordinary decimal byte counts", () => {
    expect(parseContentLength("256000")).toBe(256000);
    expect(parseContentLength("00042")).toBe(42);
  });

  it.each(["", "-1", "+1", "1.5", " 12", "12 ", "1e3", "abc", "9007199254740992"])(
    "rejects malformed or unsafe values: %s",
    (value) => {
      expect(parseContentLength(value)).toBeNull();
    },
  );
});
