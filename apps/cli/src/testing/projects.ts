// Repository shapes and host conditions shared by the CLI journeys.
import { Effect } from "effect";

import { makeGitRepository } from "./git-repository.js";

const source = (depth: number, marker: number): string =>
  `${Array.from({ length: depth }, (_, level) => `${"  ".repeat(level)}if (x) {`).join("\n")}\nrun(${marker});\n`;

/** Three files in `src/`: `a.ts` and `b.ts` always change together, `c.ts` once. */
export const makeCoupledProject = Effect.map(makeGitRepository, (repo) => {
  repo.commit(30, {
    "src/a.ts": source(3, 0),
    "src/b.ts": source(2, 0),
    "src/c.ts": source(1, 0),
  });
  for (const day of [20, 10, 5]) {
    repo.commit(day, {
      "src/a.ts": source(3, day),
      "src/b.ts": source(2, day),
    });
  }
  return repo;
});

/**
 * `ui.ts` imports `api.ts`; `config.ts` imports nothing and nothing imports it.
 * All three always change together, so each pair is coupled. Unlike the other
 * projects, the files are valid code, because the import graph parses them.
 */
export const makeImportProject = Effect.map(makeGitRepository, (repo) => {
  for (const day of [30, 20, 10, 5]) {
    repo.commit(day, {
      "src/api.ts": `export const api = ${day};\n`,
      "src/ui.ts": `import { api } from "./api.js";\nexport const ui = api + ${day};\n`,
      "src/config.ts": `export const config = ${day};\n`,
    });
  }
  return repo;
});

/**
 * `a.ts` and its test change together most often, so they are the strongest
 * coupling; `b.ts` and `c.ts` change together just as often, as a weaker pair.
 */
export const makeTestPairProject = Effect.map(makeGitRepository, (repo) => {
  for (const day of [30, 20, 10, 5]) {
    repo.commit(day, {
      "src/a.ts": source(3, day),
      "src/a.test.ts": source(2, day),
      "src/b.ts": source(1, day),
      "src/c.ts": source(2, day),
    });
  }
  return repo;
});

/** Sets PATH for the scope and restores it afterwards; spawned programs resolve against it. */
export const withPath = (value: string) =>
  Effect.acquireRelease(
    Effect.sync(() => {
      const saved = process.env["PATH"];
      process.env["PATH"] = value;
      return saved;
    }),
    (saved) =>
      Effect.sync(() => {
        process.env["PATH"] = saved;
      }),
  );

/** Empties PATH for the scope, so spawning git fails as on a machine without it. */
export const withoutGitOnPath = withPath("");
