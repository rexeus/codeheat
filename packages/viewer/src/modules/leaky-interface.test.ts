import { describe, expect, it } from "vitest";

import { moduleStats } from "../testing/reports.js";
import { isLeakyInterface } from "./leaky-interface.js";

const thresholds = { minLeakage: 0.5, minImplementationCommits: 5 };

describe("isLeakyInterface", () => {
  it("flags leakage at the threshold over enough implementation commits", () => {
    const module = moduleStats("m", { leakage: 0.5, implementationCommits: 5 });

    expect(isLeakyInterface(module, thresholds)).toBe(true);
  });

  it("does not flag leakage below the threshold", () => {
    const module = moduleStats("m", {
      leakage: 0.4999,
      implementationCommits: 50,
    });

    expect(isLeakyInterface(module, thresholds)).toBe(false);
  });

  it("does not flag a high share of too few implementation commits", () => {
    const module = moduleStats("m", { leakage: 1, implementationCommits: 4 });

    expect(isLeakyInterface(module, thresholds)).toBe(false);
  });

  it("does not flag a test-only module", () => {
    const module = moduleStats("m", { leakage: 1, testOnly: true });

    expect(isLeakyInterface(module, thresholds)).toBe(false);
  });

  it("does not flag a module without leakage data", () => {
    const module = moduleStats("m", {
      leakage: null,
      implementationCommits: 9,
    });

    expect(isLeakyInterface(module, thresholds)).toBe(false);
  });
});
