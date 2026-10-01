import { describe, expect, it } from "vitest";

import { hashOfMode, modeFromHash } from "./color-mode.js";

describe("modeFromHash", () => {
  it("opens the cohesion view for #mode=cohesion", () => {
    expect(modeFromHash("#mode=cohesion")).toBe("cohesion");
  });

  it("falls back to heat for a missing, empty or unknown mode", () => {
    expect(modeFromHash("")).toBe("heat");
    expect(modeFromHash("#")).toBe("heat");
    expect(modeFromHash("#mode=change")).toBe("heat");
    expect(modeFromHash("#other=cohesion")).toBe("heat");
  });

  it("reads the mode among other fragment parameters", () => {
    expect(modeFromHash("#a=1&mode=cohesion")).toBe("cohesion");
  });
});

describe("hashOfMode", () => {
  it("round-trips every mode through the address", () => {
    expect(modeFromHash(hashOfMode("cohesion"))).toBe("cohesion");
    expect(modeFromHash(hashOfMode("heat"))).toBe("heat");
  });
});
