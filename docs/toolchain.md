# Toolchain

Why each tool is here, how the pieces depend on each other, and how to upgrade them. Versions live in `package.json` and the `pnpm-workspace.yaml` catalog; this page explains them.

## The stack

| Tool                      | Role                                                                                                                                                                                                                      |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Node 24 (`.nvmrc`)        | Development runtime. The published package needs Node ≥ 22.12 (oxc-parser's floor); CI runs the bundle on 22.12.0.                                                                                                        |
| pnpm 12                   | Workspace and catalog. `minimumReleaseAge: 1440` (strict because set explicitly) rejects packages published less than a day ago.                                                                                          |
| turbo                     | Runs `build`, `typecheck` and `test:unit` per package in dependency order. The viewer's `build` writes `dist/assets.js`, which its own `typecheck` and `test:unit` (and later the CLI) need, so those tasks depend on it. |
| TypeScript 7              | The native compiler, patched by `@effect/tsgo` with Effect diagnostics.                                                                                                                                                   |
| oxlint + oxlint-tsgolint  | Strict, type-aware lint (`.oxlintrc.json`) and the Effect preset (`.oxlint-effect.json`).                                                                                                                                 |
| eslint-plugin-sonarjs     | Cognitive complexity, loaded by oxlint as a JS plugin.                                                                                                                                                                    |
| oxfmt                     | Formatting, import sorting, `package.json` sorting.                                                                                                                                                                       |
| knip                      | Unused files, exports, dependencies, and catalog entries. `includeEntryExports` keeps public APIs honest.                                                                                                                 |
| vitest + `@effect/vitest` | Tests; `it.effect` for Effect code.                                                                                                                                                                                       |
| oxc-parser                | The one runtime dependency of `codeheat`: parses TypeScript and JavaScript to find the imports behind hidden coupling. A native module, so it stays external to the bundle and loads lazily. See below.                   |
| rolldown                  | Bundles the viewer's browser entry into one minified script that `renderReportHtml` inlines (`pnpm --filter @codeheat/viewer build`).                                                                                     |
| tsx                       | Runs the viewer's build and dev scripts and the CLI from source (`pnpm --filter codeheat dev`, `pnpm --filter @codeheat/viewer dev`), since Node does not strip types inside `node_modules` workspace links.              |
| changesets                | Versioning and changelog for the published `codeheat` package.                                                                                                                                                            |

## Coupled versions

- **`effect`, `@effect/platform-node`, `@effect/vitest`** share one exact version (catalog). `scripts/effect-reference.mjs` pins the same version and its tag commit; `pnpm verify:effect-reference` fails when they drift.
- **`@effect/tsgo`, `oxlint`, `oxlint-tsgolint`** upgrade together. `effect-tsgo patch` (postinstall) rejects oxlint versions it does not know — for `@effect/tsgo` 0.46.1 that is oxlint 1.82–1.85.
- **`oxfmt`** moves with `oxlint`; both come from the oxc project.
- **`oxc-parser`** is pinned exactly in the catalog and is independent of the oxlint family. The CLI depends on it at runtime; the engine only has it as a dev dependency, for the adapter tests.

## Why two oxlint configs

`.oxlintrc.json` turns on the correctness, suspicious, pedantic, and perf categories as errors plus explicit size, complexity, type-safety, and import-graph rules. `.oxlint-effect.json` extends the `@effect/tsgo` recommended preset with every native category off. Keeping them apart stops the preset from changing the native defaults. The Effect config disables the preset's host-wide bans (`global-console`, `node-builtin-import`, …) that do not fit a CLI; `--deny-warnings` turns its remaining warnings into failures.

`no-redeclare` is off: it flags the schema-and-type pair (`export const Report = Schema.Struct(…)` plus `export type Report = typeof Report.Type`), and TypeScript already rejects real redeclarations.

`scripts/lint-regressions.test.ts` proves the important rules still fire, so an upgrade cannot silently weaken the gate.

## The code parser

`oxc-parser` reads the imports of TypeScript and JavaScript files (`imports` on every coupling, see the glossary's _hidden coupling_). It was chosen because it shares the oxc toolchain already in use, parses the 7,000 TypeScript files of `angular/angular` in about a second through its module record, and keeps `dist/codeheat.js` small (the bundle grew by 6.7 KB; babel's parser would have kept the bundle dependency-free but was about 4.5 times slower and throws on syntax errors).

How it fits in:

- **Native, so external.** The parser ships a binary per platform as optional dependencies, which cannot be bundled. `apps/cli/scripts/build.ts` marks `oxc-parser` external, `scripts/verify-bundle-externals.mjs` allows exactly that name, and `scripts/check-cli-package.mjs` asserts that the packed manifest has no other dependency and pins an exact version, and that a package installed with npm and with pnpm loads the parser and reports a hidden coupling.
- **Lazy and optional.** `apps/cli/src/languages/language-adapters.ts` loads it with a dynamic `import()` when a command runs. If the binary is missing (for example `npm install --omit=optional`, or a platform without a build), `analyze` and `inspect` note it once on stderr and report `imports: null`; nothing else changes.
- **Injected, not imported.** The engine never imports the parser: `typescriptAdapter(parse)` takes `parseSync` as a function, typed by `ParsedModule` in `packages/engine/src/code/typescript-adapter.ts`, which lists exactly the fields of the result the adapter reads (`module.staticImports`, `staticExports`, `dynamicImports`, `errors`, and `program` for `require()`). The CLI passes the real `parseSync`, so a renamed field fails the CLI's typecheck.
- **Stable API only.** The adapter uses the module record and, for `require()` calls, a walk over the AST of files that mention `require(`. `experimentalRawTransfer` stays off.

Memory: `oxc-parser` holds native memory for every parsed file even after garbage collection (about 0.1 MB for a typical file, more for huge ones), so the peak of a run grows with the files that take part in couplings. Only those, and the barrels they import, are parsed.

Upgrading `oxc-parser`:

1. Check the release age (see Upgrading below) and the package's `engines.node`. It must stay at or below `codeheat`'s `engines.node` (`>=22.12`); raise both, the README, and the Node pin of the `node-22` CI job together when it does not.
2. Change the version in the `pnpm-workspace.yaml` catalog (exact, no range) and run `pnpm install`.
3. Run `pnpm check`. The adapter tests parse real fixtures, and `check:package` proves that the packed package loads the parser from a fresh npm and pnpm install.
4. If the module record changed shape, `pnpm typecheck` fails in `apps/cli/src/languages/language-adapters.ts`; adjust `ParsedModule` and the adapter.

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

"Before" counted pairs of files under `a + "\0" + b` string keys; "after" numbers each universe file once per analysis and counts pairs in a nested table (lower file id → higher file id → shared commits), so no single `Map` approaches V8's limit of 2^24 entries. The default window stays far inside the budget recorded on issue #9 (under 60 s and 1 GB peak RSS): the Node process peaks near 140 MB (±10 MB between runs), and git's own peak adds roughly 275 MB. The report is byte-identical before and after apart from its timestamps. The remaining wall time is git reading the history, which `codeheat` does not control.

### Hidden coupling

The same repository and default window with hidden coupling: 797 files take part in 2,408 couplings; 658 of them are TypeScript or JavaScript and are parsed, plus the barrels they import. The wall time of `analyze --json --limit 0` goes from about 10.5 s to about 12 s on a quiet machine (about 1.5 s more CPU), and the peak RSS of the Node process from 174 MB to about 430 MB, because of the parser's native memory (see above). Before barrels were skipped unless they could re-export, about 2,100 files were parsed and the peak was 589 MB. The bundle `dist/codeheat.js` grows from 367,088 to 373,775 bytes.
