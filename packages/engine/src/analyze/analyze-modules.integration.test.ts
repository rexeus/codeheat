import { NodeServices } from "@effect/platform-node";
import { assert, layer } from "@effect/vitest";
import { Effect } from "effect";
import { TestClock } from "effect/testing";

import type { Report } from "../report/report.js";
import { analyzeOptionsFor } from "../testing/analyze-options.js";
import { makeTempRepository } from "../testing/temp-repository.js";
import type { TempRepository } from "../testing/temp-repository.js";
import { analyze } from "./analyze.js";

const setNow = TestClock.setTime(Date.parse("2026-06-01T12:00:00Z"));

const day = (number: number): string =>
  `2026-05-${String(number).padStart(2, "0")}T12:00:00Z`;

const manifest = (name: string): string => `{ "name": "${name}" }\n`;

/**
 * Three packages and one that stays quiet in the window. Counted commits
 * (a = packages/a, and so on):
 *
 * 1: a, a2        2: a, a2       3: a, b        4: a, a2, b
 * 5: a, c         6: b           7: c (and c's manifest)
 * 8: a, b, c      9: 51 bulk files of a, and b (52 files: not counted)
 */
const buildHistory = (repo: TempRepository) =>
  Effect.gen(function* () {
    yield* repo.commit("2024-01-01T12:00:00Z", {
      "packages/a/package.json": manifest("a"),
      "packages/b/package.json": manifest("b"),
      "packages/c/package.json": manifest("c"),
      "packages/d/package.json": manifest("d"),
      "packages/a/a.ts": "0\n",
      "packages/a/a2.ts": "0\n",
      "packages/b/b.ts": "0\n",
      "packages/c/c.ts": "0\n",
      "packages/d/d.ts": "0\n",
    });
    const a = "packages/a/a.ts";
    const a2 = "packages/a/a2.ts";
    const b = "packages/b/b.ts";
    const c = "packages/c/c.ts";
    yield* repo.commit(day(1), { [a]: "1\n", [a2]: "1\n" });
    yield* repo.commit(day(2), { [a]: "2\n", [a2]: "2\n" });
    yield* repo.commit(day(3), { [a]: "3\n", [b]: "3\n" });
    yield* repo.commit(day(4), { [a]: "4\n", [a2]: "4\n", [b]: "4\n" });
    yield* repo.commit(day(5), { [a]: "5\n", [c]: "5\n" });
    yield* repo.commit(day(6), { [b]: "6\n" });
    yield* repo.commit(day(7), {
      [c]: "7\n",
      "packages/c/package.json": manifest("c7"),
    });
    yield* repo.commit(day(8), { [a]: "8\n", [b]: "8\n", [c]: "8\n" });
    yield* repo.commit(day(9), {
      [b]: "9\n",
      ...Object.fromEntries(
        Array.from({ length: 51 }, (_, index) => [
          `packages/a/bulk/g${index}.ts`,
          "9\n",
        ]),
      ),
    });
  });

// a is the only module with the 5 commits that rank it, so it leads; then b, c (least cohesive first); d has no commits
const expectedModules: Report["modules"] = [
  {
    path: "packages/a",
    kind: "package" as const,
    testOnly: false,
    files: 53,
    commits: 6,
    localCommits: 2,
    cohesion: 0.3333,
    partners: [
      { path: "packages/b", sharedCommits: 3, contractsOnly: false },
      { path: "packages/c", sharedCommits: 2, contractsOnly: false },
    ],
    entryPoints: [],
    interfaceCommits: 0,
    implementationCommits: 6,
    leakage: null,
    leakyInterface: false,
    depth: null,
    trend: null,
  },
  {
    path: "packages/b",
    kind: "package" as const,
    testOnly: false,
    files: 1,
    commits: 4,
    localCommits: 1,
    cohesion: 0.25,
    partners: [
      { path: "packages/a", sharedCommits: 3, contractsOnly: false },
      { path: "packages/c", sharedCommits: 1, contractsOnly: false },
    ],
    entryPoints: [],
    interfaceCommits: 0,
    implementationCommits: 4,
    leakage: null,
    leakyInterface: false,
    depth: null,
    trend: null,
  },
  {
    path: "packages/c",
    kind: "package" as const,
    testOnly: false,
    files: 1,
    commits: 3,
    localCommits: 1,
    cohesion: 0.3333,
    partners: [
      { path: "packages/a", sharedCommits: 2, contractsOnly: false },
      { path: "packages/b", sharedCommits: 1, contractsOnly: false },
    ],
    entryPoints: [],
    interfaceCommits: 0,
    implementationCommits: 3,
    leakage: null,
    leakyInterface: false,
    depth: null,
    trend: null,
  },
  {
    path: "packages/d",
    kind: "package" as const,
    testOnly: false,
    files: 1,
    commits: 0,
    localCommits: 0,
    cohesion: null,
    partners: [],
    entryPoints: [],
    interfaceCommits: 0,
    implementationCommits: 0,
    leakage: null,
    leakyInterface: false,
    depth: null,
    trend: null,
  },
].map((module) =>
  Object.assign({}, module, {
    weightedCommits: module.commits,
    weightedLocalCommits: module.localCommits,
  }),
);

layer(NodeServices.layer)("analyze module cohesion", (it) => {
  it.effect(
    "measures each package's cohesion and partners over the counted commits",
    () =>
      Effect.gen(function* () {
        yield* setNow;
        const repo = yield* makeTempRepository;
        yield* buildHistory(repo);

        const report = yield* analyze(analyzeOptionsFor(repo));

        assert.deepStrictEqual(report.modules, expectedModules);
        assert.strictEqual(report.totals.modules, 4);
      }),
  );
});

layer(NodeServices.layer)("analyze module membership", (it) => {
  it.effect("marks files with their module and couplings that cross one", () =>
    Effect.gen(function* () {
      yield* setNow;
      const repo = yield* makeTempRepository;
      yield* buildHistory(repo);

      const report = yield* analyze(analyzeOptionsFor(repo));

      const moduleOf = new Map(report.files.map((f) => [f.path, f.module]));
      assert.deepStrictEqual(
        [
          moduleOf.get("packages/a/a.ts"),
          moduleOf.get("packages/a/bulk/g0.ts"),
          moduleOf.get("packages/d/d.ts"),
        ],
        ["packages/a", "packages/a", "packages/d"],
      );
      // a.ts + a2.ts: 3 shared of mean(6, 3) revisions; a.ts + b.ts: 3 shared of mean(6, 5)
      assert.deepStrictEqual(
        report.couplings.map(({ a, b, sharedCommits, crossesModule }) => [
          a,
          b,
          sharedCommits,
          crossesModule,
        ]),
        [
          ["packages/a/a.ts", "packages/a/a2.ts", 3, false],
          ["packages/a/a.ts", "packages/b/b.ts", 3, true],
        ],
      );
    }),
  );
});

layer(NodeServices.layer)("analyze module fallback", (it) => {
  it.effect("groups a repository without manifests by directory", () =>
    Effect.gen(function* () {
      yield* setNow;
      const repo = yield* makeTempRepository;
      yield* repo.commit(day(1), {
        "src/billing/invoice.ts": "1\n",
        "src/auth/session.ts": "1\n",
        "index.ts": "1\n",
      });
      yield* repo.commit(day(2), { "src/billing/invoice.ts": "2\n" });

      const report = yield* analyze(analyzeOptionsFor(repo));

      assert.deepStrictEqual(
        report.modules.map(({ path, kind, commits, cohesion }) => [
          path,
          kind,
          commits,
          cohesion,
        ]),
        [
          [".", "directory", 1, 0],
          ["src/auth", "directory", 1, 0],
          ["src/billing", "directory", 2, 0.5],
        ],
      );
    }),
  );

  it.effect("reports no modules for an empty repository", () =>
    Effect.gen(function* () {
      yield* setNow;
      const repo = yield* makeTempRepository;

      const report = yield* analyze(analyzeOptionsFor(repo));

      assert.deepStrictEqual(report.modules, []);
      assert.strictEqual(report.totals.modules, 0);
    }),
  );
});

const app = "packages/app";

/**
 * One package of 21 files (16 of them never change in the window) and a
 * script, so the package holds more than 70 % of at least 20 files. Counted
 * commits:
 *
 * 1: index.ts, billing/invoice.ts      2: invoice.ts, billing/tax.ts
 * 3: auth/session.ts                   4: scripts/release.ts, auth/login.ts
 */
const buildSinglePackageHistory = (repo: TempRepository) =>
  Effect.gen(function* () {
    yield* repo.commit("2024-01-01T12:00:00Z", {
      [`${app}/package.json`]: '{ "name": "app", "main": "src/index.ts" }\n',
      [`${app}/src/index.ts`]: "0\n",
      [`${app}/src/billing/invoice.ts`]: "0\n",
      [`${app}/src/billing/tax.ts`]: "0\n",
      [`${app}/src/auth/session.ts`]: "0\n",
      [`${app}/src/auth/login.ts`]: "0\n",
      "scripts/release.ts": "0\n",
      ...Object.fromEntries(
        ["billing", "auth"].flatMap((directory) =>
          Array.from({ length: 8 }, (_, index) => [
            `${app}/src/${directory}/still${index}.ts`,
            "0\n",
          ]),
        ),
      ),
    });
    yield* repo.commit(day(1), {
      [`${app}/src/index.ts`]: "1\n",
      [`${app}/src/billing/invoice.ts`]: "1\n",
    });
    yield* repo.commit(day(2), {
      [`${app}/src/billing/invoice.ts`]: "2\n",
      [`${app}/src/billing/tax.ts`]: "2\n",
    });
    yield* repo.commit(day(3), { [`${app}/src/auth/session.ts`]: "3\n" });
    yield* repo.commit(day(4), {
      "scripts/release.ts": "4\n",
      [`${app}/src/auth/login.ts`]: "4\n",
    });
  });

const expectedSplitModules: ReadonlyArray<{
  readonly kind: Report["modules"][number]["kind"];
  readonly [key: string]: unknown;
}> = [
  {
    path: `${app}/src`,
    kind: "directory",
    files: 1,
    cohesion: 0,
    entryPoints: [`${app}/src/index.ts`],
    interfaceCommits: 1,
    implementationCommits: 0,
    leakage: null,
    partners: [`${app}/src/billing`],
  },
  {
    path: `${app}/src/auth`,
    kind: "directory",
    files: 10,
    cohesion: 0.5,
    entryPoints: [],
    interfaceCommits: 0,
    implementationCommits: 2,
    leakage: null,
    partners: ["scripts"],
  },
  {
    path: `${app}/src/billing`,
    kind: "directory",
    files: 10,
    cohesion: 0.5,
    entryPoints: [],
    interfaceCommits: 0,
    implementationCommits: 2,
    leakage: null,
    partners: [`${app}/src`],
  },
  {
    path: "scripts",
    kind: "directory",
    files: 1,
    cohesion: 0,
    entryPoints: [],
    interfaceCommits: 0,
    implementationCommits: 1,
    leakage: null,
    partners: [`${app}/src/auth`],
  },
];

layer(NodeServices.layer)(
  "analyze a package that holds most of the files",
  (it) => {
    // `main` names the interface of a package, which is no module any more:
    // the module of the entry file owns it as a conventional `index.ts`.
    it.effect("measures the modules inside the only package", () =>
      Effect.gen(function* () {
        yield* setNow;
        const repo = yield* makeTempRepository;
        yield* buildSinglePackageHistory(repo);

        const report = yield* analyze(analyzeOptionsFor(repo));

        assert.deepStrictEqual(
          report.modules
            .map((module) => ({
              path: module.path,
              kind: module.kind,
              files: module.files,
              cohesion: module.cohesion,
              entryPoints: module.entryPoints,
              interfaceCommits: module.interfaceCommits,
              implementationCommits: module.implementationCommits,
              leakage: module.leakage,
              partners: module.partners.map(({ path }) => path),
            }))
            .toSorted((a, b) => a.path.localeCompare(b.path)),
          expectedSplitModules,
        );
      }),
    );
  },
);
