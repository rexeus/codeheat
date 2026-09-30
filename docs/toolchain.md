# Toolchain

Why each tool is here, how the pieces depend on each other, and how to upgrade them. Versions live in `package.json` and the `pnpm-workspace.yaml` catalog; this page explains them.

## The stack

| Tool                      | Role                                                                                                                             |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Node 24 (`.nvmrc`)        | Development runtime. The published bundle targets Node ≥ 20.                                                                     |
| pnpm 12                   | Workspace and catalog. `minimumReleaseAge: 1440` (strict because set explicitly) rejects packages published less than a day ago. |
| turbo                     | Runs `typecheck` and `test:unit` per package in dependency order.                                                                |
| TypeScript 7              | The native compiler, patched by `@effect/tsgo` with Effect diagnostics.                                                          |
| oxlint + oxlint-tsgolint  | Strict, type-aware lint (`.oxlintrc.json`) and the Effect preset (`.oxlint-effect.json`).                                        |
| eslint-plugin-sonarjs     | Cognitive complexity, loaded by oxlint as a JS plugin.                                                                           |
| oxfmt                     | Formatting, import sorting, `package.json` sorting.                                                                              |
| knip                      | Unused files, exports, dependencies, and catalog entries. `includeEntryExports` keeps public APIs honest.                        |
| vitest + `@effect/vitest` | Tests; `it.effect` for Effect code.                                                                                              |
| tsx                       | Runs the CLI from source (`pnpm --filter codeheat dev`), since Node does not strip types inside `node_modules` workspace links.  |
| changesets                | Versioning and changelog for the published `codeheat` package.                                                                   |

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
