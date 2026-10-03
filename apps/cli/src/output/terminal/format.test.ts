import { describe, expect, it } from "vitest";

import { weightLabel } from "./format.js";

describe("weightLabel", () => {
  it("writes a sum of weights in few characters", () => {
    expect(
      [0, 0.004, 0.0123, 0.42, 1, 4.84, 9.96, 18.1, 412.6].map((weight) =>
        weightLabel(weight),
      ),
    ).toStrictEqual([
      "0",
      "<0.01",
      "0.012",
      "0.42",
      "1.0",
      "4.8",
      "10",
      "18",
      "413",
    ]);
  });
});
