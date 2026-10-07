import { describe, expect, it } from "vitest";

import { dayOf, percentOf } from "./units.js";

describe("report v2 units", () => {
  it("rounds a share to a percent with 1 decimal", () => {
    expect(percentOf(0.9694)).toBe(96.9);
    expect(percentOf(0.0005)).toBe(0.1);
  });

  it("reads the UTC day of an ISO timestamp", () => {
    expect(dayOf("2026-09-29T23:59:59.000Z")).toBe("2026-09-29");
  });
});
