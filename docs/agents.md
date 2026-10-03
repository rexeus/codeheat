# Using codeheat from coding agents

Agents break code in predictable places: they edit a file without the files that always change with it, and they pile more logic into files that are already too hot. `codeheat inspect` answers both questions in a few hundred tokens, right before the edit.

## Snippet for AGENTS.md or CLAUDE.md

Paste this into the repository's agent instructions:

```md
## Before editing a file

Run `npx codeheat inspect <file> --json` (quote globs) before changing a file and read the result:

- `partners` with `probability` ≥ 0.5 usually change together with this file. Read them, and update them in the same change or state why not. A partner in a distant folder (not a `testPair`) is a hidden dependency: prefer fixing the boundary over copying the coupling.
- A partner with `imports: "none"` is hidden coupling: no import links the two files, so the compiler will not tell you when one side breaks the other. Check both files before changing either.
- A low `rank` (1 is hottest) means the file is large or nested and changes often. Keep the change small, add tests first, and prefer extracting over adding more code to it.
- A partner with `kind: "contract"` is an interface definition or schema (TypeSpec, Protocol Buffers, GraphQL, OpenAPI, JSON Schema, …): it drives this file. Change the contract first and bring the code along, and do not edit code that mirrors a contract without checking the contract.
- `reasons` explains the rank in plain words; quote it when you explain your plan.
- A non-null `copyFamily` lists files with largely the same content that keep changing in lockstep (see below). Apply the change to every member of the family in the same edit, or state why a copy stays as it is; when the same fix lands in all of them again, propose extracting the shared part.
- `modules` describes the module the file lives in (see below): a low `cohesion` means changes there usually reach into other modules; a low `depth.linesPerExport` marks a shallow module, where a new export widens an interface with little behind it.

For orientation in an unfamiliar repository, run `npx codeheat analyze --json` once: `files` are the top hotspots, `couplings` the strongest co-changing pairs, and `totals` the full size.
```

## Choosing the call

| Question                                                      | Call                                                  | Cost                                 |
| ------------------------------------------------------------- | ----------------------------------------------------- | ------------------------------------ |
| "What should I know before editing this file?"                | `codeheat inspect <file> --json`                      | One entry, ≤ 10 partners             |
| "How often do the public entry points change, and with what?" | `codeheat inspect "packages/*/src/index.ts" --json`   | One entry per match                  |
| "Where is this repository fragile?"                           | `codeheat analyze --json`                             | 25 files + 25 couplings by default   |
| "Only this package, last quarter"                             | `codeheat analyze packages/billing --since 3m --json` | Same, scoped                         |
| "Did the last quarter improve on the one before?"             | `codeheat analyze --compare 3m --json`                | Same, plus `trend` on files, modules |

With `--compare`, a file's `trend.scoreDelta` means warming (positive) or cooling (negative) only where `trend.newlyActive` and `test` are both false: a newly active file had no revisions in the previous window, so its delta is just its score, and test files are left out of the terminal's rankings. Check `comparison.previousRealCommits` first (and `window.realCommits`, the commits that are not mechanical): 0 means there was nothing to compare, and `previousTruncated` means the previous window is cut off at the start of the history.

`mechanicalCommits` counts the commits of `window.commits` that the numbers leave out (`ignored`, `renames`, `whitespace`, `reverts`, `duplicates`): they add no `revisions`, `linesAdded`, `linesDeleted`, `breadth`, or coupling. A window dominated by them (a formatting run, a mass move, a revert pair) explains why a file has fewer revisions than `git log` shows; `window.couplingCommits` is what is left for coupling and cohesion.

`logicalChanges` says how the real commits of the window were grouped into the changes that coupling, cohesion, and interface churn count (`revisions` and line counts stay per commit): `by` is `pr` (squash-merge `(#123)` suffixes or merge commits joined commits), `ticket` (ticket keys such as `PROJ-42` within 14 days did), `mixed` (both), or `commit` (nothing joined, every change is one commit), `count` is the number of changes before the 50-file limit, and `largest` the most commits one change holds. `sharedCommits`, `commits`, `interfaceCommits`, and `window.couplingCommits` count these changes, `FileStats.changes` is how many of them touched a file (`revisions` counts commits), and `degree`, `probability`, and `thresholds.hubMinRevisions` compare shared changes with a file's `changes`, so on a repository that merges pull requests, `window.couplingCommits` is far below `window.realCommits`, couplings between files that only the commits of one pull request shared disappear, and a module's `cohesion` is the share of its pull requests that stayed inside it. A pull request over 30 commits or 50 files is not counted as one change for coupling (a release branch merged in, a mass migration). Read `by: "commit"` as: no pull-request or ticket signal in the subjects or the merge structure, so a feature built in many commits still counts many times.

Every call analyzes the repository again (seconds on a repository with a few thousand commits). Call `analyze` once per task, and `inspect` per file you are about to change.

## Reading module context

The files of a repository are grouped into modules: workspace packages (a directory with its own `package.json`, `go.mod`, `Cargo.toml`, …) or directories, for files outside any package and for a package that holds most of the code on its own, which is split by its directories. Before a change, read the module of the file you are about to edit, in `modules` of the `inspect` result (the file's own `module` names it):

```json
{
  "path": "packages/billing",
  "kind": "package",
  "files": 9,
  "commits": 74,
  "localCommits": 41,
  "cohesion": 0.5541,
  "partners": [
    { "path": "packages/web", "sharedCommits": 20, "contractsOnly": false }
  ],
  "entryPoints": ["packages/billing/src/index.ts"],
  "interfaceCommits": 9,
  "implementationCommits": 71,
  "leakage": 0.1268,
  "leakyInterface": false
}
```

- `cohesion` is the share of the module's counted commits that touched nothing outside it. At 0.55, nearly half of the changes to `packages/billing` reach into another module, and `partners` says which ones, here `packages/web` in 20 of 74 commits. Plan to check those modules too, and say so when you leave them untouched.
- A high `cohesion` means the module is usually safe to change alone.
- `cohesion` is `null` when no counted commit touched the module: there is no signal, not perfect cohesion. Trust a module with few `commits` less (the ranking covers only modules with at least `thresholds.minModuleCommits`, which is `max(5, 1% of window.couplingCommits)`, and skips `testOnly` modules, whose files are all test code).
- A module partner with `contractsOnly: true` is no module but a place that holds only contract files, such as a code-free `spec/` folder: the module loses cohesion to a contract that lives outside every module. Read the contracts there before changing the module.
- A partner in `inspect` with `crossesModule: true` lives in another module than the inspected file.
- `leakage` is the share of the module's implementation commits that also touched an entry point. `leakyInterface: true` means changes inside usually change the public API too, so check the callers of the module. `modules` is in cohesion order, so look for `leakyInterface` instead of the first entries, and use `--limit 0` to see all modules. Low leakage behind an `export *` barrel does not prove a stable API.
- A coupling with `crossesModule: true` joins files of different modules. That is neutral information: an app changes with the library it uses. It is worth a look when the modules should not know each other.

`codeheat analyze --json` lists every module in `modules`, bounded by `--limit` like `files` and `couplings`; `totals.modules` is the full count. The order is the ranking: first the modules with at least `thresholds.minModuleCommits` commits that are not `testOnly`, then the other modules with commits (each group least cohesive first, ties by more `commits`, then `path`), last the modules with `cohesion: null`. The first entries are therefore the ones worth reading, also under a small `--limit`.

## Reading module depth

`depth` on a module says how much implementation sits behind its interface:

```json
{ "exports": 6, "implementationLines": 3105, "linesPerExport": 517.5 }
```

- `exports` is the number of distinct names the module's entry points export (re-exports within the module followed; a name several entry points export counts once); `implementationLines` the lines of its other files, without tests and tool configuration. A low `linesPerExport` marks a shallow module: a wide interface with little behind it, where callers must learn much and gain little. A high one marks a deep module, which hides its work behind a narrow interface.
- Before adding another export to a shallow module, ask whether the new symbol belongs behind an existing one. Before splitting a deep module, check that the split keeps its interface narrow.
- `depth: null` means unknown, not zero: no entry points, another language than TypeScript or JavaScript, a file that does not parse, CommonJS or `export =`, an `export *` from a package or another module, one that resolves to several files, two bindings of a name that cannot be told apart, no exports, no implementation files, or no parser (stderr says so). A name taken by a named re-export (`export { x } from "./gone"`) counts even when its source is an excluded or missing file or an asset. Do not read `null` as shallow.
- It measures size, not complexity, and it is read from the code as it is now, so it needs no window: `inspect` shows the depth of the module of each matched file under `modules`; `analyze` lists the shallowest ranked modules in the terminal.

## Reading contract files

Interface definitions and schemas (`.tsp`, `.proto`, `.graphql`, `.gql`, `.avsc`, `.thrift`, `.smithy`, `*.schema.json`, `openapi.*`, `asyncapi.*`, `swagger.*`) are contract files. They couple with code but are no hotspots:

- A coupling has `kinds: { a, b }` (`code` or `contract`); an `inspect` partner has `kind`. A code file whose strongest partner is a contract says so in `reasons` ("co-changes with the contract api/orders.tsp in 80% of its changes"). When the contract changes first and the code follows, change the contract, then its partners.
- `analyze` lists every contract file in `contracts` (`path`, `module`, `revisions`, `linesAdded`, `linesDeleted`; `totals.contracts` is the full count). They have no `score`, `rank`, or `complexity`, are not in `files`, and count for no module's size, leakage, or depth; they count as a touch of the module they live in for `cohesion` and `partners`.
- A contract's `imports` is always `null`: do not read it as hidden coupling.
- `ubiquitousFiles` lists contract files that changed in more than `thresholds.ubiquitousShare` of the counted commits (and in at least `thresholds.ubiquitousMinCommits`), such as a central schema every change touches. They are left out of couplings, `breadth`, and module cohesion, so a missing coupling to one of them says nothing; check `ubiquitousFiles` before concluding a file is independent of the API description.
- `inspect <contract>` lists the file in `contractFiles` and shows no entry (the terminal says to inspect the code that changes with it, exit code 4 when nothing else matched): inspect the code, not the contract. `couplings` list pairs with a code side first and pairs of two contract files after them, so a limited list keeps code pairs. A commit that touched only contract files counts in `window.commits` and `window.couplingCommits`. `--exclude` removes contract files; generated output (`tsp-output/`, `generated/`, `__generated__/`) is never read.

## Reading hidden coupling

A coupling or partner carries `imports`, and a file gets a reason ("changes with X in 70% of its changes without an import between them") when its strongest non-test partner is hidden:

- `imports: "none"` in a coupling (`a`, `b`) means neither file imports the other, directly or through a module it imports that hands the other on (a barrel, a CommonJS `module.exports`, an exported object that holds what it imported). The files change together for another reason: duplicated logic, a wire protocol, a schema, or configuration read in two places. **Check both files before changing either**, and say in your plan what ties them.
- In an `inspect` partner, `imports` is seen from the inspected file: `file→partner` (it imports the partner), `partner→file`, `both`, `none`. In a coupling it is `a→b`, `b→a`, `both`, `none`, where `a` is the lexicographically smaller path.
- `imports: null` means unknown, never "none": the file is not TypeScript or JavaScript, does not parse, no parser was available (stderr says so), or one of its imports is not accounted for (a tsconfig `paths` alias, a `#` subpath import, an undeclared package, code outside the analyzed files, a module loaded by an expression). Do not treat it as hidden coupling; read both files.
- `none` means every import of both files, and of the barrels they import through, was resolved and none links the pair. It does not see ties that are not imports.
- `thresholds.minHiddenProbability` is the co-change probability from which a hidden partner gets its reason line.

## Reading copy families

A copy family is a group of files whose content is largely the same and that change in the same commits: the same fix applied to each copy. `analyze --json` lists them in `copyFamilies` (the most fixes applied to all members first), `inspect --json` gives the family of each match as `copyFamily` (`null` for a file that is no member):

```json
{
  "files": ["packages/auth/src/index.ts", "packages/billing/src/index.ts"],
  "similarity": { "min": 0.58, "max": 0.58 },
  "testOnly": false,
  "sharedChanges": 6,
  "changesToAll": 6
}
```

- **When you change one member, change all of them** in the same edit, or say why a copy stays as it is. `sharedChanges` counts the commits that touched at least two members, `changesToAll` the commits that touched every member: a high `changesToAll` means the copies have always been fixed together, so a fix that reaches only one of them is probably incomplete.
- `similarity` is the Jaccard index of the files' five-word runs (identifiers, keywords, and the shape of literals; comments, whitespace, and punctuation do not count), 0..1; a family is built from pairs that are both coupled and at least `thresholds.minCopySimilarity` alike, so the family is connected through those pairs, while `min` and `max` are the weakest and strongest similarity over all pairs of its members. A `min` below the threshold means two members share little: read each member before applying the same edit to it.
- `testOnly: true` marks a family whose members are all test code. Such families come last in `copyFamilies` and are not listed by the terminal; tests that repeat each other are rarely the design problem, so weigh them less.
- A family means "these files change in lockstep", not "something is wrong". One adapter per entity or one config per environment is duplication on purpose; when the same fix keeps landing in all copies, the design move is to extract the shared abstraction. Do not report a family as a bug.
- Only files that already change together are compared, and only from the work tree as it is now: copies that never changed together, files too small to compare, and a coupling between a file and its own test are not families.

## Contract

Stdout carries exactly one JSON document in `--json` mode; diagnostics go to stderr. The documents are versioned by `schemaVersion`: fields may be added in version 1, never renamed or removed. Exit codes: 0 success, 2 usage error, 3 not a git repository or no git, 4 `inspect` matched nothing, 1 anything else. The shapes are defined in [`packages/engine/src/report/`](../packages/engine/src/report/).
