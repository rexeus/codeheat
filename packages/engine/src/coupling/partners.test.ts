import { describe, expect, it } from "vitest";

import type { Coupling } from "../model/analysis.js";
import { partnersOf } from "./partners.js";

const coupling = (
  b: string,
  flags: Partial<Pick<Coupling, "crossesModule" | "distance">>,
): Coupling => ({
  a: "src/a.ts",
  b,
  sharedCommits: 5,
  degree: 0.5,
  distance: 0,
  kinds: { a: "code", b: "code" },
  crossesModule: false,
  imports: null,
  ...flags,
});

/** Whether `src/a.ts`, changed in ten commits, sees its partner `b` as a distant coupling. */
const distantFlags = (
  b: string,
  flags: Parameters<typeof coupling>[1],
): ReadonlyArray<boolean> =>
  partnersOf("src/a.ts", 10, [coupling(b, flags)]).map(
    ({ distant }) => distant,
  );

describe("partnersOf distant partners", () => {
  it("marks a partner in another module and one far away within the module", () => {
    expect(distantFlags("lib/b.ts", { crossesModule: true })).toEqual([true]);
    expect(distantFlags("src/deep/er/b.ts", { distance: 3 })).toEqual([true]);
  });

  it("leaves a partner that lies near the file unmarked", () => {
    expect(distantFlags("src/deep/b.ts", { distance: 2 })).toEqual([false]);
  });
});
