# Using codeheat from coding agents

Agents break code in predictable places: they edit a file without the files that always change with it, and they pile more logic into files that are already too hot. `codeheat inspect` answers both questions in a few hundred tokens, right before the edit.

## Snippet for AGENTS.md or CLAUDE.md

Paste this into the repository's agent instructions:

```md
## Before editing a file

Run `npx codeheat inspect <file> --json` (quote globs) before changing a file and read the result:

- `partners` with `probability` ≥ 0.5 usually change together with this file. Read them, and update them in the same change or state why not. A partner in a distant folder (not a `testPair`) is a hidden dependency: prefer fixing the boundary over copying the coupling.
- A low `rank` (1 is hottest) means the file is large or nested and changes often. Keep the change small, add tests first, and prefer extracting over adding more code to it.
- `reasons` explains the rank in plain words; quote it when you explain your plan.
- `modules` describes the module the file lives in (see below): a low `cohesion` means changes there usually reach into other modules.

For orientation in an unfamiliar repository, run `npx codeheat analyze --json` once: `files` are the top hotspots, `couplings` the strongest co-changing pairs, and `totals` the full size.
```

## Choosing the call

| Question                                                      | Call                                                  | Cost                               |
| ------------------------------------------------------------- | ----------------------------------------------------- | ---------------------------------- |
| "What should I know before editing this file?"                | `codeheat inspect <file> --json`                      | One entry, ≤ 10 partners           |
| "How often do the public entry points change, and with what?" | `codeheat inspect "packages/*/src/index.ts" --json`   | One entry per match                |
| "Where is this repository fragile?"                           | `codeheat analyze --json`                             | 25 files + 25 couplings by default |
| "Only this package, last quarter"                             | `codeheat analyze packages/billing --since 3m --json` | Same, scoped                       |

Every call analyzes the repository again (seconds on a repository with a few thousand commits). Call `analyze` once per task, and `inspect` per file you are about to change.

## Reading module context

The files of a repository are grouped into modules: workspace packages (a directory with its own `package.json`, `go.mod`, `Cargo.toml`, …) or, without manifests, directories. Before a change, read the module of the file you are about to edit, in `modules` of the `inspect` result (the file's own `module` names it):

```json
{
  "path": "packages/billing",
  "kind": "package",
  "files": 9,
  "commits": 74,
  "localCommits": 41,
  "cohesion": 0.5541,
  "partners": [{ "path": "packages/web", "sharedCommits": 20 }]
}
```

- `cohesion` is the share of the module's counted commits that touched nothing outside it. At 0.55, nearly half of the changes to `packages/billing` reach into another module, and `partners` says which ones, here `packages/web` in 20 of 74 commits. Plan to check those modules too, and say so when you leave them untouched.
- A high `cohesion` means the module is usually safe to change alone.
- `cohesion` is `null` when no counted commit touched the module: there is no signal, not perfect cohesion. Trust a module with few `commits` less (the ranking covers only modules with at least `thresholds.minModuleCommits`, which is `max(5, 1% of window.couplingCommits)`, and skips `testOnly` modules, whose files are all tests or whose path has a test directory segment).
- A partner in `inspect` with `crossesModule: true` lives in another module than the inspected file.
- A coupling with `crossesModule: true` joins files of different modules. That is neutral information: an app changes with the library it uses. It is worth a look when the modules should not know each other.

`codeheat analyze --json` lists every module in `modules`, bounded by `--limit` like `files` and `couplings`; `totals.modules` is the full count. The order is the ranking: first the modules with at least `thresholds.minModuleCommits` commits that are not `testOnly`, then the other modules with commits (each group least cohesive first, ties by more `commits`, then `path`), last the modules with `cohesion: null`. The first entries are therefore the ones worth reading, also under a small `--limit`.

## Contract

Stdout carries exactly one JSON document in `--json` mode; diagnostics go to stderr. The documents are versioned by `schemaVersion`: fields may be added in version 1, never renamed or removed. Exit codes: 0 success, 2 usage error, 3 not a git repository or no git, 4 `inspect` matched nothing, 1 anything else. The shapes are defined in [`packages/engine/src/report/`](../packages/engine/src/report/).
