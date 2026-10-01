# codeheat

See where a codebase hurts. codeheat reads your git history and shows two things:

- **Hotspots** — files that are big or deeply nested _and_ change all the time. That is where bugs, merge conflicts, and slow reviews concentrate.
- **Change coupling** — files that keep changing in the same commits. When they sit in different modules, a boundary is in the wrong place, and anyone (human or agent) who edits one file without the other ships a half-done change.
- **Hidden coupling** — coupled files with no import between them (TypeScript and JavaScript). Nothing in the code points at the dependency, so duplicated logic, a wire protocol, or configuration read in two places goes unnoticed until one side changes alone.

Humans get a treemap. Agents get ranked, explained JSON.

```bash
npx codeheat analyze             # top hotspots and couplings in the terminal
npx codeheat analyze --html      # interactive treemap in the browser
npx codeheat analyze --json      # ranked, bounded report for agents and scripts
npx codeheat inspect src/billing/invoice.ts   # what to know before editing a file
```

Requires Node.js 22.12 or newer and `git` on your PATH. Works for any language; hidden coupling (below) is reported for TypeScript and JavaScript.

## The treemap

`codeheat analyze --html` writes `codeheat-report.html` — one self-contained file, no network access — and opens it.

- **Area** is lines of code, **color** is hotspot rank: the darkest tiles are the hottest 2 % of the repository. Tiles are grouped by directory, like a stock-market heatmap grouped by sector.
- **Color by** switches between _Heat_ (hotspot rank), _Cohesion_ (the module's cohesion), and _Change_ (`#mode=change`): how a file's score moved against the window before, from cooler (blue) to warmer (orange). _Change_ needs a report made with `--compare`.
- **Click a file** to see why it is hot and which files change with it. Its partners light up wherever they live in the tree; partners in distant folders are the modularization smell to look for. A partner with no import to or from the file is outlined in magenta and badged _no import_: hidden coupling.
- **Filter** by substring (`billing`) or glob (`packages/*/src/index.ts`).

`--out <file>` picks the path, `--no-open` skips the browser.

## For agents

Run `inspect` right before editing a file:

```bash
npx codeheat inspect packages/billing/src/invoice.ts --json
```

```jsonc
{
  "schemaVersion": 1,
  "window": {
    "since": "2025-09-29T12:00:00.000Z",
    "until": "2026-09-29T12:00:00.000Z",
    "commits": 212,
    "couplingCommits": 198,
  },
  "matches": [
    {
      "path": "packages/billing/src/invoice.ts",
      "rank": 1,
      "score": 0.97,
      "revisions": 48,
      "linesAdded": 384,
      "linesDeleted": 672,
      "breadth": 14,
      "test": false,
      "module": "packages/billing",
      "loc": 964,
      "complexity": {
        "total": 1900,
        "mean": 1.97,
        "max": 9,
      },
      "reasons": [
        "changed in 48 commits (#1 of 36)",
        "indentation complexity 1900 (#2 of 36)",
        "co-changes with packages/billing/src/tax.ts in 50% of its commits",
        "changes together with 14 different files",
      ],
      "trend": {
        "previousScore": 0.66,
        "previousRevisions": 33,
        "scoreDelta": 0.31,
        "newlyActive": false,
      },
      "of": 36,
      "partners": [
        {
          "path": "packages/billing/src/invoice.test.ts",
          "sharedCommits": 31,
          "probability": 0.6458,
          "testPair": true,
          "crossesModule": false,
          "imports": "partner→file",
        },
        {
          "path": "packages/billing/src/tax.ts",
          "sharedCommits": 24,
          "probability": 0.5,
          "testPair": false,
          "crossesModule": false,
          "imports": "file→partner",
        },
        {
          "path": "packages/web/src/routes/invoices.tsx",
          "sharedCommits": 14,
          "probability": 0.2917,
          "testPair": false,
          "crossesModule": true,
          "imports": "none",
        },
      ],
    },
  ],
  "modules": [
    {
      "path": "packages/billing",
      "kind": "package",
      "files": 9,
      "testOnly": false,
      "commits": 74,
      "localCommits": 41,
      "cohesion": 0.5541,
      "partners": [
        {
          "path": "packages/web",
          "sharedCommits": 20,
        },
        {
          "path": "packages/auth",
          "sharedCommits": 9,
        },
        // … 2 more modules
      ],
      "entryPoints": ["packages/billing/src/index.ts"],
      "interfaceCommits": 9,
      "implementationCommits": 71,
      "leakage": 0.1268,
      "leakyInterface": false,
      "trend": {
        "previousCohesion": 0.5241,
        "cohesionDelta": 0.03,
      },
    },
  ],
  "unmatched": [],
}
```

The example shows an illustrative shop repository (the one in `fixtures/report.sample.json`).

`probability` reads as: when this file changed, the partner changed too in that share of commits. `crossesModule` marks a partner that lives in another module. `imports` says how an import links the partner and the inspected file: `file→partner` (the file imports the partner), `partner→file`, `both`, or `none`, which is hidden coupling (read the partner before editing); it is `null` when unknown. Globs work, so `inspect "packages/*/src/index.ts"` shows how often public barrels change and what changes with them.

[docs/agents.md](docs/agents.md) has a snippet for `AGENTS.md` / `CLAUDE.md` that makes agents use it.

## Commands

### `codeheat analyze [path]`

| Flag                                  | Default          | Meaning                                                                                                                                                                                                                |
| ------------------------------------- | ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `[path]`                              | whole repository | A directory (or file) inside a repository; only files under it are analyzed. Also works for a repository elsewhere: `codeheat analyze ../other-repo`.                                                                  |
| `--since <when>`                      | `12m`            | History window: `<n>d`, `<n>w`, `<n>m`, `<n>y`, or `YYYY-MM-DD`. Old churn says little about today.                                                                                                                    |
| `--compare <duration>`                | off              | `<n>d`, `<n>w`, `<n>m`, or `<n>y`. Reports the latest window of that length and how each file's score and each module's cohesion moved against the window before it. Replaces `--since`; giving both is a usage error. |
| `--include <glob>`                    | language list    | Replaces the built-in list of ~50 source-code extensions. Repeatable.                                                                                                                                                  |
| `--exclude <glob>`                    | —                | Removes matching files. Repeatable.                                                                                                                                                                                    |
| `--limit <n>`                         | `25`             | Files, couplings, and modules in `--json`, each; `0` for all. `totals` always tells the full size.                                                                                                                     |
| `--entry <glob>`                      | detected         | Files that form a module's public interface, instead of detecting them (see interface leakage below). Repeatable.                                                                                                      |
| `--json`                              | off              | One JSON document on stdout; everything else goes to stderr.                                                                                                                                                           |
| `--html`, `--out <file>`, `--no-open` | off              | The treemap, see above.                                                                                                                                                                                                |

### `codeheat inspect <file-or-glob...>`

Paths or globs. A path without glob characters is absolute or relative to the working directory, so `codeheat inspect b.ts` works inside `src/`, and a path that does not start with `./` or `../` is read as repository-relative when nothing exists at that place in the working directory; a glob is repository-relative (quote globs so the shell leaves them alone). A path outside the repository matches nothing. The whole repository is analyzed, so ranks and partners stay relative to all files. Takes `--json`, `--since`, and `--entry`.

### Exit codes

| Code | Meaning                                                                                   |
| ---- | ----------------------------------------------------------------------------------------- |
| 0    | Success                                                                                   |
| 1    | Unexpected failure (including a git command that failed, or an unwritable `--out`)        |
| 2    | Usage error, such as an unknown flag, an invalid `--since`, or `--compare` with `--since` |
| 3    | Not inside a git repository, or `git` is not installed                                    |
| 4    | `inspect` matched no file                                                                 |

## How the numbers work

- **Universe** — the files that count: tracked by git, not ignored (also files committed before a `.gitignore` rule existed), not marked `linguist-generated` or `linguist-vendored` in `.gitattributes`, not in `vendor/`, `node_modules/`, `dist/`, `build/`, `generated/`, `__generated__/`, not minified or binary or larger than 1 MiB, and matching the language list or `--include`.
- **Revisions** — non-merge commits in the window that touched the file, following renames.
- **Indentation complexity** — the sum of indentation levels over the file's non-blank lines. A language-agnostic stand-in for nesting that tracks cyclomatic complexity well ([Tornhill, _Your Code as a Crime Scene_](https://pragprog.com/titles/atcrime2/your-code-as-a-crime-scene-second-edition/)).
- **Score** — `norm(revisions) × norm(weighted lines)`, where weighted lines are lines plus indentation levels and `norm(x) = ln(1+x) / ln(1+max)` over the repository. 0..1, relative to this repository: a 0.8 here says nothing about a 0.8 elsewhere.
- **Coupling degree** — `shared commits / mean(revisions of both)`. Pairs need 3 shared commits and a degree of 0.3. Commits touching more than 50 files (formatting runs, mass renames) are ignored for coupling.
- **Co-change probability** — `shared commits / revisions of one file`: how likely a change to that file also changes its partner. The `analyze` terminal table shows it in both directions (`a → b`, `b → a`); `inspect` shows it for the focused file.
- **Hidden coupling** — every coupling in `analyze --json` has `imports`: `a→b` when file `a` imports file `b`, `b→a`, `both`, or `none` when neither does; `inspect` partners carry it seen from the inspected file (`file→partner`, `partner→file`, `both`, `none`). The terminal shows the same in an import column (`hidden` for `none`). An import counts when it is static (`import` and `export … from`, type-only included), a dynamic `import("…")` with a plain string, a `require("…")`, or the `import("…")` of a TypeScript type; importing a module also reaches what that module hands on: what it re-exports with `export … from`, the imports that occur inside an exported expression: the initializer of an exported variable, `export default <expression>`, `export { name }` of such a variable, `export =`, `module.exports = …`, or `exports.x = …` (`import { run } from "./b"; export const api = { run };`, `module.exports = { a: require("./a") }`). Only a name that references the import counts: not a plain property key, a member after the dot, or a JSX attribute name, and not a name used inside a function or class within the expression (`export const api = { go: () => run() }` does not hand on `run`). A `require()`, `import()`, or `new URL(…, import.meta.url)` still does wherever it is, so a route table, and an exported `() => import("./page")`, hand on their pages; what a class extends is evaluated with the class and hands on, its body does not. A top-level name stands for the modules its initializer loads or refers to (`const helper = require("./h").helper`), so exporting the name hands them on. An exported `import X = …` and an exported type alias that names an imported type hand on as well; an interface that extends one does not. So a file that imports a barrel imports what the barrel hands on. A `new URL("./worker.ts", import.meta.url)` is an import of that file. Relative specifiers resolve as TypeScript does (extension, `index` file, `.js` for `.ts` in TypeScript files; a specifier that stands for both a declaration file and a runtime file links both); the name of a workspace package (`name` in its `package.json`) resolves to the files its manifest maps `"."` to (else `main`, `module`, `types`, else its `index` file), whatever `--entry` says. `none` is only reported when every module involved is accounted for: the two files, every file they import, and every file those hand on through must be readable and, where they are parsed, load nothing unresolved. Accounted for are universe files, Node built-ins (a bare name like `constants` only when no directory, and no code file without its extension, of the repository carries it), packages some `package.json` declares (or its `@types`), workspace packages, and tracked assets such as `.css` or `.json`. Otherwise `imports` is `null` (unknown): a file that is not TypeScript or JavaScript (`.ts .tsx .mts .cts .js .jsx .mjs .cjs`), does not parse, or the parser could not be loaded, and any import through a tsconfig `paths` alias, a `#` subpath import, a bundler alias or plugin scheme (`virtual:`), code outside the universe, an undeclared package or one whose name two manifests claim, component files (`.vue`, `.svelte`, `.astro`), or modules loaded by an expression (`import(name)`, `import.meta.glob()`, `require.context()`). A file whose strongest non-test co-change partner has no import and a probability of at least `thresholds.minHiddenProbability` gets a reason line.
- **Test pairs** — `a.ts` with its test (`a.test.ts`, `a.spec.ts`, `a_test.go`, `a_spec.rb`) is expected coupling; it is marked, never counted as a smell.
- **Breadth and hubs** — breadth is the number of co-changed files: distinct other files that shared a counted commit (at most 50 files) with this one, however rarely. A hub is a file changed at least 5 times, not a test, with a breadth of at least 10 among the widest 5% of such files (ties included); it gets a reason line even when no single pair is coupled strongly enough to report, as with barrels.
- **Modules and cohesion** — a module is a package (a directory below the root with a tracked `package.json`, `go.mod`, `Cargo.toml`, `pyproject.toml`, `pom.xml`, `build.gradle`, `build.gradle.kts`, or `*.csproj`; a file belongs to its nearest package) or, outside packages, a directory, cut where the files first split into two or more directories (when no depth splits them, at the first level: `scripts/release.ts` and `scripts/lib/util.ts` are one module `scripts`). A repository that yields a single module is split by directory instead. A module's cohesion is the share of its counted commits (at most 50 files) that touched no other module; `partners` lists the modules the rest touched. Modules are ranked only when they have at least `max(5, 1% of the commits counted for coupling)` counted commits (`thresholds.minModuleCommits`) and are not test-only (`testOnly`: every file is test code, by a test suffix or a `test`, `tests`, `__tests__`, `spec`, `specs`, `e2e`, `fixtures`, or `__fixtures__` directory). `modules` lists the ranked ones first, least cohesive first. A coupling between files of different modules is marked `crossesModule`, neutrally: an app legitimately changes with the library it uses.
- **Entry points and leakage** — a module's entry points are the files that make up its public interface: for a package, the files its `package.json` names in `exports` (strings and nested conditions), `main`, `module`, and `types`, counting only JavaScript and TypeScript files and no `*.config.*` files (a `*` in a target matches any files; a target without extension finds the file with that name; a target in `dist/` or `build/` stands for the same-stem source under the package's `src/` or root, when one exists), plus `index.{ts,tsx,mts,cts,js,jsx,mjs,cjs}`, `mod.rs`, `lib.rs`, and `__init__.py` at the module root or its `src/`; a directory module uses the conventional files only. `--entry` replaces all of that with the files its globs match. `interfaceCommits` counts the module's counted commits that touched an entry point, `implementationCommits` those that touched any other file of the module that is not test code (a test suffix, or a `test`, `tests`, `__tests__`, `spec`, `specs`, `e2e`, `fixtures`, or `__fixtures__` directory). Leakage is the share of the implementation commits that also touched an entry point; it is `null` without entry points or implementation commits. A high leakage means changes inside the module keep changing its public API, a sign of a shallow or leaky module. A module is flagged `leakyInterface` at a leakage of at least 50% over at least 5 implementation commits (`thresholds.minLeakage`, `thresholds.minImplementationCommits`) unless it is test-only. Its entry points that changed in at least one commit that also changed the implementation get a reason line, so a root `index.ts` that only re-exports `src/index.ts` stays unmarked. The terminal lists the first flagged modules in the order of `modules`. That order is by cohesion, so look for `leakyInterface` in the JSON and use `--limit 0` to see all modules. Read leakage with two limits in mind: behind an `export *` barrel the public API can grow in implementation files, so a low leakage does not prove a stable API; and an entry file that holds most of a module's code inflates the leakage, because every change to the module touches it.
- **Trends** — `--compare 3m` reads six months of history once and splits it at the start of the latest three months. Both halves are measured over the same files (those that exist now) and with the same fixed limits, such as the 50-file cap on counted commits; the module floor `thresholds.minModuleCommits` grows with the window, and the report's `thresholds` are the latest window's. Every other field of the report describes the latest window, exactly as `--since 3m` would. A file's `trend.scoreDelta` is its score now minus its score in the previous window (`trend.previousScore`, from `trend.previousRevisions` revisions), each normalized within its own window, so it shows a shift in standing among the files, not a change in raw revisions. `trend.newlyActive` is true for a file with no revisions in the previous window: its delta is then just its score, so it appeared rather than warmed up. `file.test` marks test code; rank warming only among files where `test` and `newlyActive` are false, as the terminal does. A module's `trend.cohesionDelta` is the change in cohesion, positive when the module became more self-contained; it is set only for a module with at least `thresholds.minModuleCommits` counted commits in both windows. A trend is `null` without `--compare`, for files when either window has no commits, and for modules that do not reach that floor in both windows. `comparison` names the previous window, counts its commits (`previousCommits`; 0 means nothing to compare, not that nothing changed), and sets `previousTruncated` when the window reaches back past the oldest commit of the repository or of a shallow clone. The terminal lists the five source files that got hotter most, the three highest-ranked newly active source files, and the five modules whose cohesion moved most, and says so when a window has no commits or is cut off. The treemap draws newly active files and files without data with a diagonal hatch, so they never pass for unchanged; a merged tile takes the color of its largest move in either direction.

The report states every threshold under `thresholds`, and the JSON contract is versioned by `schemaVersion`: new fields may appear, but a field is never renamed or removed without a new version.

## Known limits

- Hidden coupling reads imports, not other ties. Where imports are not resolved (aliases, code outside the analyzed scope or the universe), the pair is unknown (`null`) rather than hidden, so a repository that relies on aliases gets fewer answers, not wrong ones. Files in other languages than TypeScript and JavaScript report `imports: null`.
- The code parser is a native module (`oxc-parser`, the one runtime dependency of the package). Where its binary cannot load, codeheat says so on stderr, reports `imports: null`, and still runs everything else.
- Indentation is a proxy. Unusual formatting distorts it; minified files are excluded for that reason.
- Shallow clones lack history; codeheat warns and ignores the boundary commit. Run `git fetch --unshallow` for full results.
- git gives up on rename detection in very large commits (`diff.renameLimit`), and a path reused after a delete inherits the old file's history, like `git log --follow`.
- Each run reads the history again; there is no cache yet.

## Contributing

See [AGENTS.md](AGENTS.md) for the workflow and rules, [TESTING.md](TESTING.md) for tests, and [docs/](docs/README.md) for everything else. `pnpm install && pnpm check` is the gate.
