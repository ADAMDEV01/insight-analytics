import { describe, expect, it } from "vitest";
import { enforceVerifyFullSslMode } from "./connection-string";

describe("enforceVerifyFullSslMode", () => {
  it.each(["prefer", "require", "verify-ca", "REQUIRE"])(
    "normalizes legacy sslmode=%s to verify-full",
    (mode) => {
      const url = `postgresql://insight:secret@db.example.test/insight?sslmode=${mode}&application_name=insight`;

      expect(enforceVerifyFullSslMode(url)).toBe(
        "postgresql://insight:secret@db.example.test/insight?sslmode=verify-full&application_name=insight",
      );
    },
  );

  it("leaves an explicit verify-full mode unchanged", () => {
    const url = "postgresql://insight:secret@db.example.test/insight?sslmode=verify-full";

    expect(enforceVerifyFullSslMode(url)).toBe(url);
  });

  it("does not invent an SSL mode when one is not configured", () => {
    const url = "postgresql://insight:secret@db.example.test/insight";

    expect(enforceVerifyFullSslMode(url)).toBe(url);
  });

  it("does not rewrite unrelated query parameters", () => {
    const url = "postgresql://insight:secret@db.example.test/insight?application_name=sslmode=require";

    expect(enforceVerifyFullSslMode(url)).toBe(url);
  });

  it("preserves an unset database URL", () => {
    expect(enforceVerifyFullSslMode(undefined)).toBeUndefined();
  });
});
