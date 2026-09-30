# Toolchain

Why each tool is here, how the pieces depend on each other, and how to upgrade them. Versions live in `package.json` and the `pnpm-workspace.yaml` catalog; this page explains them.

## The stack

| Tool                      | Role                                                                                                                                                                                                                      |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Node 24 (`.nvmrc`)        | Development runtime. The published bundle targets Node ≥ 20.                                                                                                                                                              |
| pnpm 12                   | Workspace and catalog. `minimumReleaseAge: 1440` (strict because set explicitly) rejects packages published less than a day ago.                                                                                          |
| turbo                     | Runs `build`, `typecheck` and `test:unit` per package in dependency order. The viewer's `build` writes `dist/assets.js`, which its own `typecheck` and `test:unit` (and later the CLI) need, so those tasks depend on it. |
| TypeScript 7              | The native compiler, patched by `@effect/tsgo` with Effect diagnostics.                                                                                                                                                   |
| oxlint + oxlint-tsgolint  | Strict, type-aware lint (`.oxlintrc.json`) and the Effect preset (`.oxlint-effect.json`).                                                                                                                                 |
| eslint-plugin-sonarjs     | Cognitive complexity, loaded by oxlint as a JS plugin.                                                                                                                                                                    |
| oxfmt                     | Formatting, import sorting, `package.json` sorting.                                                                                                                                                                       |
| knip                      | Unused files, exports, dependencies, and catalog entries. `includeEntryExports` keeps public APIs honest.                                                                                                                 |
| vitest + `@effect/vitest` | Tests; `it.effect` for Effect code.                                                                                                                                                                                       |
| rolldown                  | Bundles the viewer's browser entry into one minified script that `renderReportHtml` inlines (`pnpm --filter @codeheat/viewer build`).                                                                                     |
| tsx                       | Runs the viewer's build and dev scripts and the CLI from source (`pnpm --filter codeheat dev`, `pnpm --filter @codeheat/viewer dev`), since Node does not strip types inside `node_modules` workspace links.              |
| changesets                | Versioning and changelog for the published `codeheat` package.                                                                                                                                                            |

## Coupled versions

- **`effect`, `@effect/platform-node`, `@effect/vitest`** share one exact version (catalog). `scripts/effect-reference.mjs` pins the same version and its tag commit; `pnpm verify:effect-reference` fails when they drift.
- **`@effect/tsgo`, `oxlint`, `oxlint-tsgolint`** upgrade together. `effect-tsgo patch` (postinstall) rejects oxlint versions it does not know — for `@effect/tsgo` 0.46.1 that is oxlint 1.82–1.85.
- **`oxfmt`** moves with `oxlint`; both come from the oxc project.

## Why two oxlint configs

`.oxlintrc.json` turns on the correctness, suspicious, pedantic, and perf categories as errors plus explicit size, complexity, type-safety, and import-graph rules. `.oxlint-effect.json` extends the `@effect/tsgo` recommended preset with every native category off. Keeping them apart stops the preset from changing the native defaults. The Effect config disables the preset's host-wide bans (`global-console`, `node-builtin-import`, …) that do not fit a CLI; `--deny-warnings` turns its remaining warnings into failures.

`no-redeclare` is off: it flags the schema-and-type pair (`export const Report = Schema.Struct(…)` plus `export type Report = typeof Report.Type`), and TypeScript already rejects real redeclarations.

`scripts/lint-regressions.test.ts` proves the important rules still fire, so an upgrade cannot silently weaken the gate.

## Upgrading

1. Check the release age: pnpm rejects versions younger than a day. Wait rather than relaxing the policy.
2. Upgrade Effect by changing the catalog **and** `scripts/effect-reference.mjs` (version and the commit of tag `effect@<version>`: `git ls-remote https://github.com/Effect-TS/effect refs/tags/effect@<version>`), then `pnpm install`.
3. Upgrade `@effect/tsgo` with the oxlint versions it supports; `pnpm install` fails fast otherwise.
4. Run `pnpm check`. Read the Effect changelog for renamed APIs — the CLI and child-process modules changed between release candidates.

## Performance

`analyze` was measured on a full clone of `angular/angular` (about 38.7k commits, 10.6k tracked files, 8.1k files in the universe) with `--json --limit 1`. Times are wall clock; RSS is the peak of the `codeheat` Node process. `git log`, which runs as a separate process and dominates the wall time, is listed apart.

| Window                     | Commits | Wall time | Node peak RSS, before → after | `git log` alone |
| -------------------------- | ------- | --------- | ----------------------------- | --------------- |
| 12 months (default)        | 2,325   | 10 s      | 150 MB → 137 MB               | 9 s, 275 MB     |
| `--since 10y` (unbudgeted) | 15,577  | 43 s      | 264 MB → 175 MB               | 40–60 s, 638 MB |

"Before" counted pairs of files under `a + "\0" + b` string keys; "after" numbers files once per analysis and counts pairs under the integer `low * fileCount + high`. The default window stays far inside the budget (under 60 s and 1 GB peak RSS): the Node process peaks near 140 MB, and git's own peak adds roughly 275 MB. The report is byte-identical before and after apart from its timestamps. The remaining wall time is git reading the history, which `codeheat` does not control.
