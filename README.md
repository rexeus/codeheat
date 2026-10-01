# codeheat

See where a codebase hurts. codeheat reads your git history and shows two things:

- **Hotspots** — files that are big or deeply nested _and_ change all the time. That is where bugs, merge conflicts, and slow reviews concentrate.
- **Change coupling** — files that keep changing in the same commits. When they sit in different modules, a boundary is in the wrong place, and anyone (human or agent) who edits one file without the other ships a half-done change.

Humans get a treemap. Agents get ranked, explained JSON.

```bash
npx codeheat analyze             # top hotspots and couplings in the terminal
npx codeheat analyze --html      # interactive treemap in the browser
npx codeheat analyze --json      # ranked, bounded report for agents and scripts
npx codeheat inspect src/billing/invoice.ts   # what to know before editing a file
```

Requires Node.js 22 or newer and `git` on your PATH. Works for any language.

## The treemap

`codeheat analyze --html` writes `codeheat-report.html` — one self-contained file, no network access — and opens it.

- **Area** is lines of code, **color** is hotspot rank: the darkest tiles are the hottest 2 % of the repository. Tiles are grouped by directory, like a stock-market heatmap grouped by sector.
- **Click a file** to see why it is hot and which files change with it. Its partners light up wherever they live in the tree; partners in distant folders are the modularization smell to look for.
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
      "of": 36,
      "score": 0.97,
      "revisions": 48,
      "loc": 964,
      "complexity": { "total": 1900, "mean": 1.97, "max": 9 },
      "reasons": [
        "changed in 48 commits (#1 of 36)",
        "indentation complexity 1900 (#2 of 36)",
        "co-changes with packages/billing/src/tax.ts in 50% of its commits",
      ],
      "partners": [
        {
          "path": "packages/billing/src/invoice.test.ts",
          "sharedCommits": 31,
          "probability": 0.6458,
          "testPair": true,
          "crossesModule": false,
        },
        {
          "path": "packages/billing/src/tax.ts",
          "sharedCommits": 24,
          "probability": 0.5,
          "testPair": false,
          "crossesModule": false,
        },
        {
          "path": "packages/web/src/routes/invoices.tsx",
          "sharedCommits": 14,
          "probability": 0.2917,
          "testPair": false,
          "crossesModule": true,
        },
      ],
    },
  ],
  "unmatched": [],
}
```

The example shows an illustrative shop repository (the one in `fixtures/report.sample.json`).

`probability` reads as: when this file changed, the partner changed too in that share of commits. `crossesModule` marks a partner that lives in another module. Globs work, so `inspect "packages/*/src/index.ts"` shows how often public barrels change and what changes with them.

[docs/agents.md](docs/agents.md) has a snippet for `AGENTS.md` / `CLAUDE.md` that makes agents use it.

## Commands

### `codeheat analyze [path]`

| Flag                                  | Default          | Meaning                                                                                                                                               |
| ------------------------------------- | ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `[path]`                              | whole repository | A directory (or file) inside a repository; only files under it are analyzed. Also works for a repository elsewhere: `codeheat analyze ../other-repo`. |
| `--since <when>`                      | `12m`            | History window: `<n>d`, `<n>w`, `<n>m`, `<n>y`, or `YYYY-MM-DD`. Old churn says little about today.                                                   |
| `--include <glob>`                    | language list    | Replaces the built-in list of ~50 source-code extensions. Repeatable.                                                                                 |
| `--exclude <glob>`                    | —                | Removes matching files. Repeatable.                                                                                                                   |
| `--limit <n>`                         | `25`             | Files, couplings, and modules in `--json`, each; `0` for all. `totals` always tells the full size.                                                    |
| `--entry <glob>`                      | detected         | Files that form a module's public interface, instead of detecting them (see interface leakage below). Repeatable.                                     |
| `--json`                              | off              | One JSON document on stdout; everything else goes to stderr.                                                                                          |
| `--html`, `--out <file>`, `--no-open` | off              | The treemap, see above.                                                                                                                               |

### `codeheat inspect <file-or-glob...>`

Paths or globs. A path without glob characters is absolute or relative to the working directory, so `codeheat inspect b.ts` works inside `src/`, and a path that does not start with `./` or `../` is read as repository-relative when nothing exists at that place in the working directory; a glob is repository-relative (quote globs so the shell leaves them alone). A path outside the repository matches nothing. The whole repository is analyzed, so ranks and partners stay relative to all files. Takes `--json`, `--since`, and `--entry`.

### Exit codes

| Code | Meaning                                                                            |
| ---- | ---------------------------------------------------------------------------------- |
| 0    | Success                                                                            |
| 1    | Unexpected failure (including a git command that failed, or an unwritable `--out`) |
| 2    | Usage error, such as an unknown flag or an invalid `--since`                       |
| 3    | Not inside a git repository, or `git` is not installed                             |
| 4    | `inspect` matched no file                                                          |

## How the numbers work

- **Universe** — the files that count: tracked by git, not ignored (also files committed before a `.gitignore` rule existed), not marked `linguist-generated` or `linguist-vendored` in `.gitattributes`, not in `vendor/`, `node_modules/`, `dist/`, `build/`, `generated/`, `__generated__/`, not minified or binary or larger than 1 MiB, and matching the language list or `--include`.
- **Revisions** — non-merge commits in the window that touched the file, following renames.
- **Indentation complexity** — the sum of indentation levels over the file's non-blank lines. A language-agnostic stand-in for nesting that tracks cyclomatic complexity well ([Tornhill, _Your Code as a Crime Scene_](https://pragprog.com/titles/atcrime2/your-code-as-a-crime-scene-second-edition/)).
- **Score** — `norm(revisions) × norm(weighted lines)`, where weighted lines are lines plus indentation levels and `norm(x) = ln(1+x) / ln(1+max)` over the repository. 0..1, relative to this repository: a 0.8 here says nothing about a 0.8 elsewhere.
- **Coupling degree** — `shared commits / mean(revisions of both)`. Pairs need 3 shared commits and a degree of 0.3. Commits touching more than 50 files (formatting runs, mass renames) are ignored for coupling.
- **Co-change probability** — `shared commits / revisions of one file`: how likely a change to that file also changes its partner. The `analyze` terminal table shows it in both directions (`a → b`, `b → a`); `inspect` shows it for the focused file.
- **Test pairs** — `a.ts` with its test (`a.test.ts`, `a.spec.ts`, `a_test.go`, `a_spec.rb`) is expected coupling; it is marked, never counted as a smell.
- **Breadth and hubs** — breadth is the number of co-changed files: distinct other files that shared a counted commit (at most 50 files) with this one, however rarely. A hub is a file changed at least 5 times, not a test, with a breadth of at least 10 among the widest 5% of such files (ties included); it gets a reason line even when no single pair is coupled strongly enough to report, as with barrels.
- **Modules and cohesion** — a module is a package (a directory below the root with a tracked `package.json`, `go.mod`, `Cargo.toml`, `pyproject.toml`, `pom.xml`, `build.gradle`, `build.gradle.kts`, or `*.csproj`; a file belongs to its nearest package) or, outside packages, a directory, cut where the files first split into two or more directories (when no depth splits them, at the first level: `scripts/release.ts` and `scripts/lib/util.ts` are one module `scripts`). A repository that yields a single module is split by directory instead. A module's cohesion is the share of its counted commits (at most 50 files) that touched no other module; `partners` lists the modules the rest touched. Modules are ranked only when they have at least `max(5, 1% of the commits counted for coupling)` counted commits (`thresholds.minModuleCommits`) and are not test-only (`testOnly`: every file is test code, by a test suffix or a `test`, `tests`, `__tests__`, `spec`, `specs`, `e2e`, `fixtures`, or `__fixtures__` directory). `modules` lists the ranked ones first, least cohesive first. A coupling between files of different modules is marked `crossesModule`, neutrally: an app legitimately changes with the library it uses.
- **Entry points and leakage** — a module's entry points are the files that make up its public interface: for a package, the files its `package.json` names in `exports` (strings and nested conditions), `main`, `module`, and `types` (a target in `dist/` or `build/` stands for the same-stem source under the package's `src/` or root, when one exists), plus `index.{ts,tsx,mts,cts,js,jsx,mjs,cjs}`, `mod.rs`, `lib.rs`, and `__init__.py` at the module root or its `src/`; a directory module uses the conventional files only. `--entry` replaces all of that with the files its globs match. `interfaceCommits` counts the module's counted commits that touched an entry point, `implementationCommits` those that touched any other file of the module that is not test code (a test suffix, or a `test`, `tests`, `__tests__`, `spec`, `specs`, `e2e`, `fixtures`, or `__fixtures__` directory). Leakage is the share of the implementation commits that also touched an entry point; it is `null` without entry points or implementation commits. A high leakage means changes inside the module keep changing its public API, a sign of a shallow or leaky module. At 50% over at least 5 implementation commits, the entry points of a module that is not test-only get a reason line, and the terminal lists the leakiest interfaces (a separate ranking by leakage; `modules` keeps its cohesion order).

The report states every threshold under `thresholds`, and the JSON contract is versioned by `schemaVersion`: new fields may appear, but a field is never renamed or removed without a new version.

## Known limits

- Indentation is a proxy. Unusual formatting distorts it; minified files are excluded for that reason.
- Shallow clones lack history; codeheat warns and ignores the boundary commit. Run `git fetch --unshallow` for full results.
- git gives up on rename detection in very large commits (`diff.renameLimit`), and a path reused after a delete inherits the old file's history, like `git log --follow`.
- Each run reads the history again; there is no cache yet.

## Contributing

See [AGENTS.md](AGENTS.md) for the workflow and rules, [TESTING.md](TESTING.md) for tests, and [docs/](docs/README.md) for everything else. `pnpm install && pnpm check` is the gate.
