import { describe, expect, it } from "vitest";
import { apiError, apiSuccess, readJson } from "./http";

function jsonRequest(body: string) {
  return new Request("http://localhost/api/test", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
}

describe("HTTP helpers", () => {
  it("parses valid JSON request bodies", async () => {
    await expect(readJson(jsonRequest('{"name":"INSIGHT"}'))).resolves.toEqual({ name: "INSIGHT" });
  });

  it("returns null for malformed JSON and bodies above the 64 KB limit", async () => {
    await expect(readJson(jsonRequest("{"))).resolves.toBeNull();
    await expect(readJson(jsonRequest("x".repeat(64 * 1024 + 1)))).resolves.toBeNull();
  });

  it("prevents authenticated API responses from being cached", async () => {
    const success = apiSuccess({ value: 1 });
    const error = apiError("Unauthorized", 401, "UNAUTHORIZED");

    expect(success.headers.get("cache-control")).toBe("private, no-store");
    expect(error.headers.get("cache-control")).toBe("private, no-store");
    expect(error.status).toBe(401);
  });
});
