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

/** Empties PATH for the scope, so spawning git fails as on a machine without it. */
export const withoutGitOnPath = Effect.acquireRelease(
  Effect.sync(() => {
    const saved = process.env["PATH"];
    process.env["PATH"] = "";
    return saved;
  }),
  (saved) =>
    Effect.sync(() => {
      process.env["PATH"] = saved;
    }),
);
