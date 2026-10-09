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
 * `api/orders.tsp` is a contract that changes together with `src/orders.ts` in
 * four commits; `tsp-output/openapi.yaml` is what the contract generates.
 */
export const makeContractProject = Effect.map(makeGitRepository, (repo) => {
  for (const day of [30, 20, 10, 5]) {
    repo.commit(day, {
      "api/orders.tsp": `model Order { id: ${day} }\n`,
      "src/orders.ts": source(2, day),
      "tsp-output/openapi.yaml": `version: ${day}\n`,
    });
  }
  return repo;
});

/**
 * Two packages that change together in five commits, so both are ranked.
 * `lib` exports `run` and `stop` through `src/index.ts`, with four lines of
 * implementation behind them; `app` has no entry point.
 */
export const makeDepthProject = Effect.map(makeGitRepository, (repo) => {
  for (const day of [30, 20, 10, 5, 3]) {
    repo.commit(day, {
      "packages/lib/package.json":
        '{ "name": "lib", "main": "src/index.ts" }\n',
      "packages/lib/src/index.ts": `export { run, stop } from "./impl.js";\n// ${day}\n`,
      "packages/lib/src/impl.ts": `export const run = ${day};\nexport const stop = 0;\nconst a = 1;\nconst b = 2;\n`,
      "packages/app/package.json": '{ "name": "app" }\n',
      "packages/app/src/main.ts": `export const main = ${day};\n`,
    });
  }
  return repo;
});

/**
 * Three packages whose files change together in five commits and import
 * nothing from each other: every pair of files is a hidden, distant coupling,
 * and the packages form a clique.
 */
export const makeCliqueProject = Effect.map(makeGitRepository, (repo) => {
  for (const day of [30, 20, 10, 5, 3]) {
    repo.commit(day, {
      "packages/a/package.json": '{ "name": "a" }\n',
      "packages/a/src/a.ts": `export const a = ${day};\n`,
      "packages/b/package.json": '{ "name": "b" }\n',
      "packages/b/src/b.ts": `export const b = ${day};\n`,
      "packages/c/package.json": '{ "name": "c" }\n',
      "packages/c/src/c.ts": `export const c = ${day};\n`,
    });
  }
  return repo;
});

const importsApi = (name: string, day: number): string =>
  `import { api } from "./api.js";\nexport const ${name} = api + ${day};\n`;

/**
 * `src/api.ts` is imported by five files. It changes in every commit, `u1.ts`
 * and `u2.ts` with it, while `u3.ts` to `u5.ts` change only in the first.
 */
export const makeInterfaceProject = Effect.map(makeGitRepository, (repo) => {
  const names = ["u1", "u2", "u3", "u4", "u5"];
  repo.commit(30, {
    "src/api.ts": "export const api = 30;\n",
    ...Object.fromEntries(
      names.map((name) => [`src/${name}.ts`, importsApi(name, 30)]),
    ),
  });
  for (const day of [20, 10, 5, 3]) {
    repo.commit(day, {
      "src/api.ts": `export const api = ${day};\n`,
      "src/u1.ts": importsApi("u1", day),
      "src/u2.ts": importsApi("u2", day),
    });
  }
  return repo;
});

/**
 * Two pairs that change together in four commits each: `a.ts` with `d.ts`,
 * which sorts first, and `b.ts` with `c.ts`; `e.ts` changes once, alone.
 */
export const makeTwoPairProject = Effect.map(makeGitRepository, (repo) => {
  for (const day of [30, 20, 10, 5]) {
    repo.commit(day, {
      "src/a.ts": source(3, day),
      "src/d.ts": source(2, day),
    });
    repo.commit(day - 1, {
      "src/b.ts": source(1, day),
      "src/c.ts": source(2, day),
    });
  }
  repo.commit(2, { "src/e.ts": source(2, 2) });
  return repo;
});

/** Eight statements of four words; `owner` is the one word in which two copies differ (23 of their 33 runs of five words are shared). */
const handler = (owner: string, day: number): string =>
  `${Array.from(
    { length: 8 },
    (_, index) =>
      `export const ${index === 3 ? owner : `step${index}`} = value${index};`,
  ).join("\n")}\n// ${day}\n`;

/** Three copies of one handler in different directories, changed together in four commits. */
export const makeCopyProject = Effect.map(makeGitRepository, (repo) => {
  for (const day of [30, 20, 10, 5]) {
    repo.commit(day, {
      "lib/billing/handler.ts": handler("billing", day),
      "src/orders/handler.ts": handler("orders", day),
      "src/users/handler.ts": handler("users", day),
    });
  }
  return repo;
});

/**
 * `billing` and `web` hold three files each. Six commits change `billing/a.ts`
 * alone; six change `billing/b.ts` together with `web/a.ts`, so half of the
 * changes that touch `billing` reach into `web`, and every one of `web`'s.
 */
export const makeLeakyProject = Effect.map(makeGitRepository, (repo) => {
  const folders = ["billing", "web"];
  repo.commit(
    60,
    Object.fromEntries(
      folders.flatMap((folder) =>
        ["a", "b", "c"].map((name): [string, string] => [
          `${folder}/${name}.ts`,
          source(2, 0),
        ]),
      ),
    ),
  );
  for (const day of [55, 54, 53, 52, 51, 50]) {
    repo.commit(day, { "billing/a.ts": source(3, day) });
  }
  for (const day of [45, 44, 43, 42, 41, 40]) {
    repo.commit(day, {
      "billing/b.ts": source(3, day),
      "web/a.ts": source(2, day),
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
