import { describe, expect, it } from "vitest";

import { fitLabel } from "./label.js";

describe("fitLabel", () => {
  it("keeps a label that fits", () => {
    expect(fitLabel("index.ts", 100)).toBe("index.ts");
  });

  it("truncates a label that is too wide with an ellipsis", () => {
    expect(fitLabel("invoice-calculator.ts", 63)).toBe("invoice-c…");
  });

  it("omits the label when only a few characters would fit", () => {
    expect(fitLabel("invoice-calculator.ts", 20)).toBeNull();
  });
});
