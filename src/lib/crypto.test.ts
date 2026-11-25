import { describe, expect, it } from "vitest";
import { createPublishableKey, hashApiKey, verifySecret } from "./crypto";

describe("API key cryptography", () => {
  it("creates distinct publishable keys with the expected prefix", () => {
    const first = createPublishableKey();
    const second = createPublishableKey();
    expect(first).toMatch(/^ia_pub_[A-Za-z0-9_-]{40,}$/);
    expect(second).not.toBe(first);
  });

  it("hashes keys deterministically without returning the original value", () => {
    const value = createPublishableKey();
    const digest = hashApiKey(value);
    expect(digest).toMatch(/^[a-f0-9]{64}$/);
    expect(digest).toBe(hashApiKey(value));
    expect(digest).not.toContain(value);
  });

  it("compares secrets safely and rejects unequal values", () => {
    expect(verifySecret("secret-value", "secret-value")).toBe(true);
    expect(verifySecret("secret-value", "another-value")).toBe(false);
    expect(verifySecret("short", "longer")).toBe(false);
  });
});
