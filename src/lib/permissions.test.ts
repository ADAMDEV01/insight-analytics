import { describe, expect, it } from "vitest";
import { hasMinimumRole } from "./permissions";

describe("workspace role hierarchy", () => {
  it("allows lower roles to read but not administer", () => {
    expect(hasMinimumRole("viewer", "viewer")).toBe(true);
    expect(hasMinimumRole("viewer", "analyst")).toBe(false);
    expect(hasMinimumRole("analyst", "analyst")).toBe(true);
    expect(hasMinimumRole("analyst", "admin")).toBe(false);
    expect(hasMinimumRole("admin", "analyst")).toBe(true);
    expect(hasMinimumRole("owner", "admin")).toBe(true);
  });
});
