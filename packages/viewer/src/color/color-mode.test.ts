import { describe, expect, it } from "vitest";

import { hashOfMode, modeFromHash } from "./color-mode.js";

describe("modeFromHash", () => {
  it("opens the cohesion view for #mode=cohesion", () => {
    expect(modeFromHash("#mode=cohesion", false)).toBe("cohesion");
  });

  it("opens the change view for #mode=change when the report compares windows", () => {
    expect(modeFromHash("#mode=change", true)).toBe("change");
  });

  it("falls back to heat for #mode=change without a comparison", () => {
    expect(modeFromHash("#mode=change", false)).toBe("heat");
  });

  it("falls back to heat for a missing, empty or unknown mode", () => {
    expect(modeFromHash("", true)).toBe("heat");
    expect(modeFromHash("#", true)).toBe("heat");
    expect(modeFromHash("#mode=trend", true)).toBe("heat");
    expect(modeFromHash("#other=cohesion", true)).toBe("heat");
  });

  it("reads the mode among other fragment parameters", () => {
    expect(modeFromHash("#a=1&mode=cohesion", false)).toBe("cohesion");
  });
});

describe("hashOfMode", () => {
  it("round-trips every mode through the address", () => {
    expect(modeFromHash(hashOfMode("cohesion"), true)).toBe("cohesion");
    expect(modeFromHash(hashOfMode("change"), true)).toBe("change");
    expect(modeFromHash(hashOfMode("heat"), true)).toBe("heat");
  });
});
