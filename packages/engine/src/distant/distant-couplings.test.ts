import { describe, expect, it } from "vitest";

import type { ModuleRef } from "../modules/detect.js";
import type { Coupling } from "../report/report.js";
import { distantCouplings } from "./distant-couplings.js";

const MODULES: ReadonlyMap<string, ModuleRef> = new Map(
  [
    ["packages/core/src/a.ts", "packages/core"],
    ["packages/core/src/deep/er/b.ts", "packages/core"],
    ["packages/core/src/c.ts", "packages/core"],
    ["packages/core/test/a.test.ts", "packages/core"],
    ["packages/compiler/src/x.ts", "packages/compiler"],
    ["packages/compiler/src/y.ts", "packages/compiler"],
    ["packages/compiler/src/w.ts", "packages/compiler"],
    ["tools/cli/src/z.ts", "tools/cli"],
    ["packages/core/spec/api.tsp", "packages/core"],
    ["packages/compiler/api/api.tsp", "packages/compiler"],
  ].map(([file = "", path = ""]) => [file, { path, kind: "package" }]),
);

/** A coupling of two files with the given strength and distance; `crossesModule` follows `MODULES`. */
const coupling = (
  a: string,
  b: string,
  options: Partial<Coupling> & { readonly degree: number },
): Coupling => ({
  a,
  b,
  sharedCommits: 6,
  distance: 2,
  testPair: false,
  kinds: { a: "code", b: "code" },
  crossesModule: MODULES.get(a)?.path !== MODULES.get(b)?.path,
  imports: null,
  ...options,
});

const pair = (path: string, imports: Coupling["imports"]): Coupling =>
  coupling("packages/core/src/a.ts", path, { degree: 0.4, imports });

const scoresOf = (couplings: ReadonlyArray<Coupling>) =>
  distantCouplings(couplings, MODULES).map(({ a, b, score }) => ({
    pair: `${a} ${b}`,
    score,
  }));

describe("distantCouplings scores", () => {
  it("scores a pair across modules as strength times one plus the hops between the module directories", () => {
    const result = distantCouplings(
      [
        coupling("packages/core/src/a.ts", "packages/compiler/src/x.ts", {
          degree: 0.5,
          distance: 4,
        }),
        coupling("packages/core/src/a.ts", "tools/cli/src/z.ts", {
          degree: 0.5,
          distance: 5,
        }),
      ],
      MODULES,
    );

    // packages/core to packages/compiler is 2 hops, to tools/cli 4 hops.
    expect(result.map(({ score }) => score)).toEqual([2.5, 1.5]);
    expect(result[0]?.modules).toEqual({
      a: "packages/core",
      b: "tools/cli",
    });
  });

  it("scores a distant pair within a module by its share of the largest distance, below any pair across modules", () => {
    const within = coupling(
      "packages/core/src/a.ts",
      "packages/core/src/deep/er/b.ts",
      { degree: 0.8, distance: 3 },
    );
    const across = coupling(
      "packages/core/src/a.ts",
      "packages/compiler/src/x.ts",
      { degree: 0.3, distance: 5 },
    );

    expect(scoresOf([within, across])).toEqual([
      { pair: "packages/core/src/a.ts packages/compiler/src/x.ts", score: 0.9 },
      {
        pair: "packages/core/src/a.ts packages/core/src/deep/er/b.ts",
        score: 0.48,
      },
    ]);
  });
});

describe("distantCouplings selection", () => {
  it("leaves out pairs within a module that are not far apart", () => {
    expect(
      scoresOf([
        coupling("packages/core/src/a.ts", "packages/core/src/c.ts", {
          degree: 0.9,
          distance: 0,
        }),
        coupling("packages/core/src/a.ts", "packages/core/src/deep/er/b.ts", {
          degree: 0.9,
          distance: 2,
        }),
      ]),
    ).toEqual([]);
  });
});

describe("distantCouplings hidden coupling, exclusions, and ranking", () => {
  it("ranks a hidden coupling a half higher and leaves an unknown or visible import neutral", () => {
    expect(
      scoresOf([
        pair("packages/compiler/src/x.ts", null),
        pair("packages/compiler/src/y.ts", "none"),
        pair("packages/compiler/src/w.ts", "a→b"),
      ]).map(({ score }) => score),
    ).toEqual([1.8, 1.2, 1.2]);
  });

  it("leaves out every pair with a test-code file, recognized as a test pair or not", () => {
    expect(
      scoresOf([
        coupling("packages/core/src/a.ts", "packages/core/test/a.test.ts", {
          degree: 0.9,
          distance: 3,
          testPair: true,
        }),
        coupling("packages/compiler/src/x.ts", "packages/core/test/a.test.ts", {
          degree: 0.9,
        }),
      ]),
    ).toEqual([]);
  });

  it("keeps a contract coupled to code, though it lies in a spec directory, and drops a pair of two contracts", () => {
    const withCode = coupling(
      "packages/core/spec/api.tsp",
      "packages/compiler/src/x.ts",
      { degree: 0.5, kinds: { a: "contract", b: "code" } },
    );
    const contracts = coupling(
      "packages/compiler/api/api.tsp",
      "packages/core/spec/api.tsp",
      { degree: 0.9, kinds: { a: "contract", b: "contract" } },
    );

    expect(
      distantCouplings([withCode, contracts], MODULES).map(({ a }) => a),
    ).toEqual(["packages/core/spec/api.tsp"]);
  });

  it("breaks ties by strength, shared commits, then path and keeps the best fifty", () => {
    const many = Array.from({ length: 60 }, (_, index) =>
      coupling("packages/core/src/a.ts", `packages/compiler/src/f${index}.ts`, {
        degree: 0.3 + index / 1000,
      }),
    );
    const result = distantCouplings(many, MODULES);

    expect(result).toHaveLength(50);
    expect(result[0]?.b).toBe("packages/compiler/src/f59.ts");
    expect(result[49]?.b).toBe("packages/compiler/src/f10.ts");
  });
});
