# Using codeheat from coding agents

Agents break code in predictable places: they edit a file without the files that always change with it, and they pile more logic into files that are already too hot. `codeheat inspect` answers both questions in a few hundred tokens, right before the edit.

## Snippet for AGENTS.md or CLAUDE.md

Paste this into the repository's agent instructions:

```md
## Before editing a file

Run `npx codeheat inspect <file> --json` (quote globs) before changing a file and read the result:

- `partners` with `probability` ≥ 0.5 usually change together with this file. Read them, and update them in the same change or state why not. A partner with `distant: true` lies in another module or far away in the tree (never a test): the change crosses a design boundary. Read it, and prefer fixing the boundary over copying the coupling.
- A partner with `imports: "none"` is hidden coupling: no import links the two files, so the compiler will not tell you when one side breaks the other. Check both files before changing either.
- A low `rank` (1 is hottest) means the file is large or nested and changes often. Keep the change small, add tests first, and prefer extracting over adding more code to it.
- A partner with `kind: "contract"` is an interface definition or schema (TypeSpec, Protocol Buffers, GraphQL, OpenAPI, JSON Schema, …): it drives this file. Change the contract first and bring the code along, and do not edit code that mirrors a contract without checking the contract.
- `reasons` explains the rank in plain words; quote it when you explain your plan.
- A non-null `copyFamily` lists files with largely the same content that keep changing in lockstep (see below). Apply the change to every member of the family in the same edit, or state why a copy stays as it is; when the same fix lands in all of them again, propose extracting the shared part.
- `heat` says how old the file's hotness is: `chronic` (hot in at least half of the windows before the last two and half of all its windows, so a design problem: do not add more to it, split it) or `acute` (hot in both of the last two windows and in fewer than half of the earlier ones, so current work: expect it to settle, and finish the feature before refactoring); `null` for any other file. The series covers at least the last 24 months, so a file can be chronic unless the repository is younger than about 15 months.
- `modules` describes the module the file lives in (see below): a low `cohesion` means changes there usually reach into other modules; a low `depth.linesPerExport` marks a shallow module, where a new export widens an interface with little behind it.

For orientation in an unfamiliar repository, run `npx codeheat analyze --json` once: `erosion.verdict` says whether the design holds over time, `changeRadius` and `propagationCost` say how far a typical change spreads, `files` are the top hotspots, `couplings` the strongest co-changing pairs, and `totals` the full size. `distantCouplings` are the pairs that change together across modules or far apart, `cliques` the modules that change as a group, `unstableInterfaces` the files many others import that keep changing, and `dependencyDirection` the imports that point from stable to volatile modules (see "Reading distant coupling and scaling signals"). `territories` divides the code into areas with a description each: read `details[recommended - 1]` to find your way (see "Reading territories"), `territoryCoupling` and `territoryCliques` say which of them change together, and `entryPoints` ranks the places to start (see "Reading entry points").
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

`window.lastCommitAt` is when the newest commit of the repository was made (the committer time of `HEAD`, an ISO timestamp), whatever the window; `null` only for a repository without commits. It is the newest commit, not the last change to the analysed files (a documentation-only commit, or an analysis of one folder, moves it without touching the code in scope). When `window.realCommits` is 0 it says how old the repository's newest commit is; a longer `--since` reads more history. The terminal prints it in that case only.

`mechanicalCommits` counts the commits of `window.commits` that the numbers leave out (`ignored`, `renames`, `whitespace`, `reverts`, `duplicates`): they add no `revisions`, `linesAdded`, `linesDeleted`, `breadth`, or coupling. A window dominated by them (a formatting run, a mass move, a revert pair) explains why a file has fewer revisions than `git log` shows; `window.couplingCommits` is what is left for coupling and cohesion.

`logicalChanges` says how the real commits of the window were grouped into logical changes, the unit that coupling, cohesion, and interface churn count: `by` is `pr` (a squash-merge `(#123)` suffix, or a merge commit that names a pull or merge request, joined commits), `ticket` (a ticket key such as `PROJ-42` within 14 days did), `mixed` (both), or `commit` (nothing joined, every change is one commit); `count` is the number of changes before the 50-file limit, and `largest` the most commits one change holds. The direct commits of an integration branch (a pull request merge that names a release or `develop` branch as its source, or whose branch itself contains pull request merges or squash-merged pull requests such as `(#12)` suffixes, `Merged PR 12: …`, or `Pull request #12: …`) stay single commits, while the pull requests merged into it keep their own changes. Merge commits that are no pull request (`git pull`, a merge of the mainline into a branch, a tag, a plain `Merge branch 'x'`) group nothing. A pull request of more than 30 commits splits into its commits; one of at most 30 commits that touches more than 50 files (the union of its commits' files) is left out of coupling like a wide commit. Read `by: "commit"` as: no pull-request or ticket signal in the subjects or the merge commits, so a feature built in many commits still counts many times.

These fields count logical changes (their names keep saying commits): `window.couplingCommits`, `Coupling.sharedCommits` and so `degree`, `Partner.probability` (shared changes over the inspected file's `changes`), `Module.commits`, `localCommits`, `interfaceCommits`, `implementationCommits`, `ModulePartner.sharedCommits`, `leakage` and `cohesion` (and their trends), `UbiquitousFile.commits` and `share`, `CopyFamily.sharedChanges` and `changesToAll`, `FileStats.breadth`, the hub test (`thresholds.hubMinRevisions` is compared with `FileStats.changes`), `thresholds.minSharedCommits`, `minModuleCommits`, `minImplementationCommits`, and `ubiquitousMinCommits`. `FileStats.changes` and `ContractFile.changes` are new and count the logical changes that touched a file; `revisions`, `linesAdded`, `linesDeleted`, and the score stay per commit, and so does `window.commits`/`realCommits`.

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
  "radius": 1,
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

- `cohesion` is the share of the module's counted changes that touched nothing outside it. At 0.55, nearly half of the changes to `packages/billing` reach into another module, and `partners` says which ones, here `packages/web` in 20 of 74 changes. Plan to check those modules too, and say so when you leave them untouched.
- A high `cohesion` means the module is usually safe to change alone.
- `radius` is the median number of modules, itself included, that the counted changes touching the module touched (test-only modules not counted; a lower median, so a whole number): 1 means its changes usually stay inside (the same as a `cohesion` of at least 0.5, test-only modules aside), 2 means a typical change here also touches one other module, which `partners` names. `null` when no counted change touched the module, and for a `testOnly` module.
- `cohesion` is `null` when no counted change touched the module: there is no signal, not perfect cohesion. Trust a module with few counted `commits` (changes) less (the ranking covers only modules with at least `thresholds.minModuleCommits`, which is `max(5, 1% of window.couplingCommits)`, and skips `testOnly` modules, whose files are all test code).
- A module partner with `contractsOnly: true` is no module but a place that holds only contract files, such as a code-free `spec/` folder: the module loses cohesion to a contract that lives outside every module. Read the contracts there before changing the module.
- A partner in `inspect` with `crossesModule: true` lives in another module than the inspected file.
- `leakage` is the share of the module's implementation changes that also touched an entry point. `leakyInterface: true` means changes inside usually change the public API too, so check the callers of the module. `modules` is in cohesion order, so look for `leakyInterface` instead of the first entries, and use `--limit 0` to see all modules. Low leakage behind an `export *` barrel does not prove a stable API.
- A partner in `inspect` with `crossesModule: true` lives in another module than the inspected file. `distant` adds that it is not test code and not a contract pair: those are the partners that show the module boundary leaking.
- A coupling with `crossesModule: true` joins files of different modules. That is neutral information: an app changes with the library it uses. It is worth a look when the modules should not know each other.

`codeheat analyze --json` lists every module in `modules`, bounded by `--limit` like `files` and `couplings`; `totals.modules` is the full count. The order is the ranking: first the modules with at least `thresholds.minModuleCommits` changes that are not `testOnly`, then the other modules with counted changes (each group least cohesive first, ties by more `commits`, then `path`), last the modules with `cohesion: null`. The first entries are therefore the ones worth reading, also under a small `--limit`.

## Reading territories

`analyze --json` also divides the code into territories, a tree of non-overlapping areas you can read at six levels of detail. Use it to find your way in a repository you do not know, before you read the hotspots:

```json
{
  "territories": {
    "recommended": 2,
    "details": [
      { "level": 1, "ids": ["t2", "t3"] },
      { "level": 2, "ids": ["t4", "t3", "t5", "t6"] }
    ],
    "nodes": [
      {
        "id": "t1",
        "path": ".",
        "kind": "folder",
        "parent": null,
        "children": ["t2", "t3"],
        "files": 52,
        "testFiles": 14,
        "changes": 120,
        "heatShare": 1,
        "description": "The shop: billing and a web app.",
        "splitReason": "the first cut: top-level folders",
        "fit": null
      },
      {
        "id": "t2",
        "path": "packages/billing",
        "kind": "package",
        "parent": "t1",
        "children": ["t4", "t5", "t6"],
        "files": 38,
        "testFiles": 9,
        "changes": 74,
        "heatShare": 0.7113,
        "description": "Invoices and tax for the shop.",
        "splitReason": "invoice and tax change independently: 81% of the 74 changes touching it stay inside one part",
        "fit": {
          "detail": 2,
          "containment": 0.62,
          "radius": 1,
          "partner": {
            "territory": "t3",
            "sharedChanges": 21,
            "share": 0.2838
          },
          "distantPairs": 4,
          "hiddenPairs": 2,
          "cliques": 1,
          "erosion": null,
          "chronicFiles": 2,
          "acuteFiles": 0,
          "chronicShare": 0.4721,
          "fixDensity": { "fixes": 23, "share": 0.3108, "spanning": 9 }
        }
      },
      {
        "id": "t3",
        "path": "apps/web",
        "kind": "package",
        "parent": "t1",
        "children": [],
        "files": 14,
        "testFiles": 5,
        "changes": 46,
        "heatShare": 0.2887,
        "description": "The web app: routes, hooks, and components.",
        "splitReason": null
      },
      {
        "id": "t4",
        "path": "packages/billing/src/invoice",
        "kind": "folder",
        "parent": "t2",
        "children": [],
        "files": 17,
        "testFiles": 2,
        "changes": 41,
        "heatShare": 0.41,
        "description": "main files: invoice, line-item, totals",
        "splitReason": null
      },
      {
        "id": "t5",
        "path": "packages/billing/src/tax",
        "kind": "folder",
        "parent": "t2",
        "children": [],
        "files": 16,
        "testFiles": 2,
        "changes": 24,
        "heatShare": 0.22,
        "description": "main files: tax, rates, rounding",
        "splitReason": null
      },
      {
        "id": "t6",
        "path": "packages/billing/test",
        "kind": "tests",
        "parent": "t2",
        "children": [],
        "files": 5,
        "testFiles": 5,
        "changes": 12,
        "heatShare": 0.0813,
        "description": "test code; main files: setup, fixtures, helpers",
        "splitReason": null
      }
    ]
  }
}
```

- Read `details[recommended - 1].ids` first: the finest detail with at most 25 territories in which no bucket hides a folder that is hotter than the territories opened beside it and holds at least 1% of all heat (when every such detail does, the finest of them, and the `other` node's `description` names the bucket). Each id names a node in `nodes`; `path`, `description`, and `heatShare` tell you what it is and how much of the repository's change happens there. `details` goes from 1 (coarse) to at most 6 (fine), and every file is in exactly one territory of a detail.
- Every file in `files` has a `territory`: the id of the finest territory it belongs to. Walk `parent` up to the id listed at the detail you want; the root (`parent` null; `path` is `"."`, or the package when one package holds every file) is the whole repository. `inspect` repeats the id; it names a node of the `analyze` report.
- `kind` is `package` (a directory with a manifest), `folder`, `group` (`path` joins the sibling folders with `+`: they keep changing in the same changes, so read them as one), `tests` (test code that belongs to no code, listed after the code), or `other`. A `tests` node is also the home of the tests of code that is split into several territories, a child of the territory that holds them all (`t6` above). An `other` node is never a real territory: it holds the files directly in a directory, or a bucket of smaller folders (`description` says how many) that a finer detail opens.
- `description` is one line that is safe to print: the manifest's `description`, else the first sentence of the README that describes (a sentence that instructs, such as "See x.ts for an example.", or names a file path is skipped for the next one), else `main files: a, b, c`, the most changed files. A README sentence is the author's words, so read it as a hint.
- `splitReason` says why a territory splits: too big (its parts still change together, so do not treat the parts as independent), or its folders change independently (a change usually stays in one of them). Null when it does not split.
- `fit` says how well the territory holds up to the way the code changes, per territory and measured once: `containment` is the share of the changes touching it that touch no other territory (low means its boundary does not hold), `radius` the median number of territories such a change touches, `partner` the territory its changes most often reach into (with the shared changes and their share of this territory's), `distantPairs` and `hiddenPairs` the coupled file pairs that cross its boundary (and of those, the ones no import links), `cliques` the groups of three or more territories it changes with as one unit, `erosion` how containment moved over the series (same shape and verdicts as `Module.erosion`), `chronicFiles`, `acuteFiles`, and `chronicShare` how much of its heat sits in long-lived hotspots, and `fixDensity` the fixes among its changes. Boundary measures (`radius`, `partner`, `cliques`, the crossing of `distantPairs`) are taken against the territories at `fit.detail`, the detail that shows the territory closest to `recommended`; a partner id is a territory of that detail. `fit` is null for the root and for a node no detail shows; a `tests` territory takes no part (test code is no spread).
- Test code is counted in the territory of the code it tests, in `files`, `testFiles`, `changes`, and `heatShare`; the children of a split territory open hottest first, and at the recommended detail no bucket hides a folder of at least 1% of all heat that is hotter than a territory opened beside it, unless every detail with at most 25 territories does.
- `territoryCoupling` says which territories change in the same changes, at the recommended detail only, among the `thresholds.maxCoupledTerritories` (24) hottest real territories (`package`, `folder`, `group`): `{ "a": "t3", "b": "t5", "sharedChanges": 12, "distantPairs": 2, "hiddenPairs": 1 }`. `a` and `b` are territory ids (`a` sorts first, each pair is listed once, the strongest first), `sharedChanges` the counted changes that touched both (counted by the code behind `fit.partner`, so the `partner` of a territory among those hottest is among its pairs, with the same count, unless the partner is not one of them: the recommended detail can show more territories), `distantPairs` the coupled file pairs between the two, and `hiddenPairs` of those the ones no import links. Only pairs that share at least `thresholds.minSharedCommits` changes between territories with at least `thresholds.minModuleCommits` changes each are listed; a missing pair means "not enough evidence of change together", not "independent". `territoryCliques` lists the groups of three or more territories at the recommended detail that change as one unit (the rule of a clique, see "Reading distant coupling and scaling signals", over territories): `territories` (ids, sorted), `sharedChanges` (changes that touched every member), `weakestShare`, `heatShare`, and `codeHeatShare`, the numbers an entry point of kind `clique` is scored on. Both are in `analyze --json` only and `--limit` does not cut them. v2 will move them under `coupling`.
- `--limit` does not cut `territories`: the tree is complete in every report.
- `modules` is unchanged and not a view of the territories; cohesion, partners, and the other module measures still describe modules.

## Reading entry points

`analyze --json` also ranks where the design fails and where to start. Read `entryPoints` and the territory of the file you are about to edit before you edit:

```json
{
  "entryPoints": [
    {
      "rank": 1,
      "kind": "boundary",
      "score": 0.5096,
      "territories": ["t2"],
      "files": [],
      "evidence": {
        "chronicHeatShare": 0.332,
        "chronicShare": 0.5321,
        "chronicFiles": 2,
        "containment": 0.5541,
        "fixShare": 0.3108,
        "heatShare": 0.6239,
        "changes": 74,
        "distantPairs": 3,
        "hiddenPairs": 1,
        "cliques": 0,
        "partnerShare": 0.2838,
        "codeHeatShare": 0.5812
      },
      "verdict": "The boundary does not hold, and it holds less than it used to: changes here keep reaching into other territories.",
      "designMove": "Move a boundary: bring what changes together with packages/billing into one territory, or give the part they share a home of its own; start with packages/web.",
      "findings": [
        {
          "kind": "boundary",
          "verdict": "The boundary does not hold, and it holds less than it used to: changes here keep reaching into other territories.",
          "designMove": "Move a boundary: bring what changes together with packages/billing into one territory, or give the part they share a home of its own; start with packages/web.",
          "evidence": {
            "heatShare": 0.6239,
            "containment": 0.5541,
            "changes": 74,
            "chronicShare": 0.5321,
            "fixShare": 0.3108,
            "distantPairs": 3,
            "hiddenPairs": 1,
            "cliques": 0,
            "partnerShare": 0.2838,
            "codeHeatShare": 0.5812
          },
          "files": [],
          "territories": ["t2"]
        },
        {
          "kind": "hotspot",
          "verdict": "Chronic hotspot: the same files stay among the hottest quarter after quarter.",
          "designMove": "Split a hotspot: break packages/billing/src/invoice.ts and packages/billing/src/tax.ts into parts that each change for one reason.",
          "evidence": {
            "chronicHeatShare": 0.332,
            "chronicShare": 0.5321,
            "chronicFiles": 2,
            "containment": 0.5541,
            "fixShare": 0.3108
          },
          "files": [
            "packages/billing/src/invoice.ts",
            "packages/billing/src/tax.ts"
          ],
          "territories": ["t2"]
        }
      ]
    }
  ]
}
```

- At most ten entries, best `rank` first; empty when nothing qualifies. `--limit` does not cut the list. `territories` are ids of `territories.nodes` (the territory itself, both territories of a boundary between two, the members of a clique, or the territories that hold the files); `files` are the files of a file kind (a hotspot's, the hottest first) and empty for `boundary` and `clique` and for a territory that is both a boundary and a hotspot. With `--limit`, a file named in `files` may be missing from the report's `files`: use `inspect` or `--limit 0`. `evidence` is a map of named numbers; a number that does not exist is left out.
- `kind` says what to do and why: `boundary` (move a boundary) is a territory whose changes keep reaching into others, and that has a `fit.partner` to name as the one they reach into (a territory with no partner is never a boundary entry: nothing says where it leaks); `hotspot` (split a hotspot) is a territory whose heat is mostly in chronic hotspot `files`; `clique` (extract a shared abstraction) is a group of territories that change as one unit; `copies` (extract a shared abstraction) is a family of `files` that change in lockstep; `hub` (break up a hub) is an unstable interface in `files`; `coupling` (centralize a contract) is a pair of `files` in different territories that change together although no import links them. The rule of every kind, with its score and evidence names, is in one table in the README ("Where to start") and the GLOSSARY ("Entry point (of a report)"); its gates are in `thresholds` (`minEntryHeatShare`, `maxEntryContainment`, `minEntryChronicShare`, `minEntryChanges`, `minEntryCouplingChanges`, `minEntryScore`, `maxEntriesPerKind`, `maxEntries`).
- One story is one entry. A territory that is both a `boundary` and a `hotspot` is one entry: `kind`, `verdict`, `designMove`, and `score` are those of the stronger finding, `evidence` holds the numbers of both (the stronger finding's where a name repeats), and `findings` lists both, the stronger first, each with its own `verdict`, `designMove`, `evidence`, `files`, and `territories` (the ids it is about). Two territories that are each other's `fit.partner` and both qualify as a `boundary` are one `boundary` entry about both: `territories` lists both (the stronger first), the `verdict` and `designMove` name both paths, `score` is the sum of the two boundaries, `evidence` is that of both together, each change and each file pair counted once: `codeHeatShare` and `heatShare` add (the territories do not overlap); `changes` counts the changes that touched either (the two territories' changes less those both touched); `sharedChanges` counts those that touched both; `containment` is the share of those `changes` that stayed inside one of the two (touched neither another territory nor both), the changes inside either over `changes`; `partnerShare` is `sharedChanges / changes`; `chronicShare` is the share of the pair's production heat in chronic hotspots (each territory's weighted by its `codeHeatShare`); `fixShare` is each territory's share of fixes weighted by its changes (a change that touched both counts for each, and the fixes among those are not known, so it is an approximation); `distantPairs` and `hiddenPairs` count the coupled file pairs that leave the pair for a third territory, and the pairs between the two once; `cliques` counts the cliques that have either territory as a member, and `findings` lists that finding first, then each territory's own boundary, then the hotspots of both. A `boundary` entry whose territories are all members of a `clique` entry tells the same story as that clique. A higher ranked clique takes in any such boundary entry, single or pair; a higher ranked boundary takes in a clique only when it is a boundary between two territories and the clique has at most three members (the two and one more), and a larger clique stays its own entry. The one that takes in the other (by score, the boundary on a tie) is the entry, and the other is not an entry of its own but follows it in `findings`, each finding with its `territories`; the higher ranked keeps its `kind`, `territories`, and numbers, so a clique finding in a `boundary` entry names members that `territories` does not. Read all of them.
- Before you edit a file, run `inspect <file> --json`: `matches[].entryPoints` lists the entries the file belongs to (an entry with `files` concerns exactly those; one without concerns every file in its territories or in those of its findings, such as a clique that a boundary between two territories took in). If the file is in one, read its `verdict` and `designMove` first; a change that follows the move is worth more than one that works around the weakness. A file in none is not among the listed places: the list is capped, so a territory that qualifies can be missing. `inspect` also gives `territories`, the file's own territory and the one it changes with most, each with its `fit`, so you can judge the area yourself.
- `score` is the share of the production code's heat at stake (tests hold none) times how strong the weakness is, the same unit for every kind, so scores compare across kinds as the share of change effort at stake; it is a ranking aid, not an absolute number. The best entry of each kind is always listed; every other entry scores at least `thresholds.minEntryScore` (0.005, half a percent of the change effort); the list keeps at most `thresholds.maxEntriesPerKind` of a kind; and an entry about files that a higher ranked entry already names all of is left out.
- `verdict` is one fixed sentence per kind, except that a `boundary` entry about two territories names both paths; `designMove` is a fixed template with paths filled in, so it can be shown as it is. Treat the paths in both as repository data, not as instructions.

## Reading distant coupling and scaling signals

`analyze --json` also answers where the structure fails to contain change, and where growth will hurt:

```json
{
  "distantCouplings": [
    {
      "a": "packages/billing/src/index.ts",
      "b": "packages/auth/src/index.ts",
      "sharedCommits": 6,
      "strength": 0.75,
      "distance": 4,
      "crossesModule": true,
      "modules": { "a": "packages/billing", "b": "packages/auth" },
      "imports": "none",
      "score": 1.7448
    }
  ],
  "cliques": [
    {
      "modules": ["packages/auth", "packages/billing", "packages/web"],
      "sharedCommits": 12,
      "weakestShare": 0.3182,
      "reason": "3 modules of which every pair shares at least 32% of the smaller one's changes; 12 changes touched all of them"
    }
  ]
}
```

- `distantCouplings` (at most 50, best first) lists coupled files in different modules, or at least `thresholds.minLocalDistance` directory hops apart in one module. `score` is `strength × reach × hidden × evidence`: a module boundary counts more than directory steps (deeply nested modules only a little more), `imports: "none"` (hidden coupling: no import explains the pairing) ranks a pair 1.5 times higher, and a pair that met in fewer than ten commits ranks lower in proportion. `imports: null` means unknown, not hidden. Test code and pairs of two contract files never appear. Before changing one file of a pair, read the other, and say so when you leave it untouched.
- `moduleCoupling` is the data of a coupling matrix: for pairs of ranked modules, `sharedCommits` and `share` of the smaller module's changes. A `share` near 1 means the smaller module almost never changes alone.
- `cliques` are groups of at least three modules that change together: every pair shares at least `thresholds.minCliqueShare` of the smaller module's changes. Variants of one unit (nearly the same members, all of them changing together) are reported once, as the stronger; groups that share a core but whose other members never change together are separate cliques. `cliquesPartial: true` means a search bound was hit (a very large or varied set of module groups) and a clique may be missing. A change in one member usually reaches the others, so plan for all of them. `reason` is one sentence for the report.
- `unstableInterfaces` (TypeScript and JavaScript) lists files that at least `thresholds.minFanIn` files import and that change more often than their dependents: `fanIn`, `changes` (logical changes: how often the file was changed as a whole), `medianDependentChanges`, `changedDependents` (dependents that changed in a change that also changed the file), and the `dependents` that changed with it most often. Changing one of these ripples; add tests first, keep the change backwards compatible, and prefer splitting what keeps changing from what many rely on. Dependencies are read as text and only the ones that resolve to files count, so a repository that imports through path aliases shows a lower `fanIn` than it has.
- `dependencyDirection` (TypeScript and JavaScript) lists import edges from a module that rarely changes (`fromCommits`) to one that changes often (`toCommits`, at least `thresholds.minVolatilityRatio` times as many): a change to `to` reaches code that otherwise sits still. The list ranks by `ratio` (`toCommits` over `fromCommits`) and `changesTogether` (counted changes in which a file of `from` changed together with a file of `to` that it imports), so the first entries are where a change to `to` really did drag `from` along. Check `importingFiles` before changing `to`'s public API.

## Reading how far a change spreads

`analyze --json` summarizes whether the structure contains change:

```json
{
  "changeRadius": { "changes": 170, "median": 1, "p90": 3, "local": 0.6412 },
  "propagationCost": { "cost": 0.0612, "files": 31 }
}
```

- `changeRadius` counts the modules each counted change touched (test-only modules left out; a change that touched no other module is not measured). `median` is the modules a typical change touches (a lower median, so a whole number), `p90` the most that nine in ten touch, `local` the share that touched exactly one module, and `changes` how many changes were measured. A `local` near 1 and a `median` of 1 mean the design holds: plan a change inside one module. A `p90` of 4 or more means a tenth of the changes spread widely; check `cliques` and `distantCouplings` for where. The numbers depend on the modules detected: finer modules give a larger radius, and a repository with a single module always reads 1. `null` when no counted change touched a module. `changes` can be lower than `window.couplingCommits`: a change that touched only files that are dead today, or no module, is not measured.
- `propagationCost` is the mean share of the other files a file reaches through chains of at most `thresholds.propagationDepth` couplings (the pairs in `couplings`), over the `files` that are not test code and have at least `thresholds.minSharedCommits` counted changes (large changes are not counted). At 0.06, a change to a typical file drags along about 6% of the files that change regularly, through up to three hops of co-change. 0 means no file is coupled, 1 that everything reaches everything. The cost shrinks as the number of regularly changing files grows, so it is a within-repository, over-time measure: compare it across windows of one repository, not between repositories. The terminal does not show it. Read it with the change radius: a low radius with a high cost means coupling inside modules. `null` when fewer than two files have enough changes.
- `modules[].radius` gives the radius around one module, and `inspect` shows it with the file's module.

## Reading how the design moved over time

`analyze --json` also says whether the design holds up over time, from windows of about a quarter of a year (91 days) cut from the last 24 months or more of history (`seriesSince` says where they start, which can be before `window.since`; the snapshot measures keep using `window`): at most twelve, so they grow longer once the span covers more than three years, and none when the history is shorter than about 4.5 months (20 weeks). The default gives eight windows, `--since 3y` twelve:

```json
{
  "series": [
    {
      "since": "2025-09-29T12:00:00.000Z",
      "until": "2025-12-29T18:00:00.000Z",
      "changes": 38,
      "active": true,
      "changeRadius": { "changes": 38, "median": 1, "p90": 3, "local": 0.7895 },
      "propagationCost": { "cost": 0.0493, "files": 24 }
    }
  ],
  "erosion": {
    "verdict": "eroding",
    "inactiveSince": null,
    "windows": 4,
    "locality": { "from": 0.7812, "to": 0.5078, "slope": -0.0911 },
    "propagationCost": { "from": 0.0499, "to": 0.0733, "slope": 0.0078 }
  },
  "fixDensity": {
    "changes": 178,
    "fixes": 41,
    "conventional": 0.7584,
    "known": true,
    "share": 0.2303
  }
}
```

- `erosion.verdict` is `eroding` (the share of changes that stay in one module, `locality`, fell between the first and the last active window of a robust line), `improving` (it rose), `holding`, or `unknown` (fewer than `thresholds.minTrendWindows` active windows). A shift counts only when it is at least `thresholds.minErosionShift` **and** `thresholds.minErosionSigmas` standard errors of the shift, computed from how many changes each window holds, so a flat design reads `holding`: windows with few changes need a bigger move. The verdict must also follow without the first and the last active window, so one odd window at either end does not decide it; that needs `thresholds.minVerdictWindows` (5) active windows, and with fewer the verdict is `holding`. The verdict describes the active period: windows without `thresholds.minWindowChanges` changes are left out wherever they lie, so quiet windows never cause an `improving`. Quote the numbers, not only the word. `erosion.inactiveSince` is the start of the quiet run that ends the series (null when the last window is active): when it is set, the verdict is about how the repository was, and says nothing about the present. `erosion` is `null` when `series` is empty (a history shorter than about 4.5 months). `locality.from` and `to` are the line's own values and can lie slightly outside 0 to 1. `propagationCost` is context only: it rises when more files change often enough to be coupled.
- A window with `active: false` has too few changes to say anything; its numbers are listed but nothing rests on them. A pull request that spans two windows is split between them, so the windows' `changes` can add up to slightly more than `window.couplingCommits`.
- A module's `erosion` is the same robust line through its `cohesion` per window (`null` in windows where the module had fewer than 10 changes or too few to rank it, and the module `null` without three such windows), with the same gate in `verdict`, including the check without its first and last window (so at least five windows to be anything but `holding`). Only `verdict: "eroding"` with `recent: true` marks a module that keeps pulling other modules into its changes: look at its `partners`, `cliques`, and `distantCouplings` before adding to it. `recent: false` means it stopped changing; `holding` means the share only wobbled.
- `fixDensity.known: false` means fewer than `thresholds.minConventionShare` (5 %) of the commit subjects match a fix rule or a Conventional Commits type (`conventional` is that share), so the share of fixes is **unknown, not 0**: do not read a missing share as a quality signal. A team that writes free text but often starts with "Fix" does get a share. When known, `Module.fixDensity.share` is the share of the module's changes that fix something, and `spanning` those fixes that also touched another module: a high `spanning` marks a fragile boundary. The fix rules (Conventional Commits `fix`/`hotfix`/`bugfix`/`revert`, `Revert "`, `fix` or `bug` as the first word but not `bug` followed by a ticket number, and `subsystem: fix …` with a lowercase scope) are fixed in the engine.
- `FileStats.heat` (`chronic`, `acute`, or `null`, with `hotWindows` of `windows`) is also in `inspect`; see the snippet above.

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
- `analyze` lists every contract file in `contracts` (`path`, `module`, `revisions`, `changes`, `linesAdded`, `linesDeleted`; `totals.contracts` is the full count). They have no `score`, `rank`, or `complexity`, are not in `files`, and count for no module's size, leakage, or depth; they count as a touch of the module they live in for `cohesion` and `partners`.
- A contract's `imports` is always `null`: do not read it as hidden coupling.
- `ubiquitousFiles` lists contract files that changed in more than `thresholds.ubiquitousShare` of the counted changes (and in at least `thresholds.ubiquitousMinCommits`), such as a central schema every change touches. They are left out of couplings, `breadth`, and module cohesion, so a missing coupling to one of them says nothing; check `ubiquitousFiles` before concluding a file is independent of the API description.
- `inspect <contract>` lists the file in `contractFiles` and shows no entry (the terminal says to inspect the code that changes with it, exit code 4 when nothing else matched): inspect the code, not the contract. `couplings` list pairs with a code side first and pairs of two contract files after them, so a limited list keeps code pairs. A commit that touched only contract files counts in `window.commits`, and its change in `window.couplingCommits`. `--exclude` removes contract files; generated output (`tsp-output/`, `generated/`, `__generated__/`) is never read.

## Reading hidden coupling

A coupling or partner carries `imports`, and a file gets a reason ("changes with X in 70% of its changes without an import between them") when its strongest non-test partner is hidden:

- `imports: "none"` in a coupling (`a`, `b`) means neither file imports the other, directly or through a module it imports that hands the other on (a barrel, a CommonJS `module.exports`, an exported object that holds what it imported). The files change together for another reason: duplicated logic, a wire protocol, a schema, or configuration read in two places. **Check both files before changing either**, and say in your plan what ties them.
- In an `inspect` partner, `imports` is seen from the inspected file: `file→partner` (it imports the partner), `partner→file`, `both`, `none`. In a coupling it is `a→b`, `b→a`, `both`, `none`, where `a` is the lexicographically smaller path.
- `imports: null` means unknown, never "none": the file is not TypeScript or JavaScript, does not parse, no parser was available (stderr says so), or one of its imports is not accounted for (a tsconfig `paths` alias, a `#` subpath import, an undeclared package, code outside the analyzed files, a module loaded by an expression). Do not treat it as hidden coupling; read both files.
- `none` means every import of both files, and of the barrels they import through, was resolved and none links the pair. It does not see ties that are not imports.
- `thresholds.minHiddenProbability` is the co-change probability from which a hidden partner gets its reason line.

## Reading copy families

A copy family is a group of files whose content is largely the same and that change in the same changes: the same fix applied to each copy. `analyze --json` lists them in `copyFamilies` (the most fixes applied to all members first), `inspect --json` gives the family of each match as `copyFamily` (`null` for a file that is no member):

```json
{
  "files": ["packages/auth/src/index.ts", "packages/billing/src/index.ts"],
  "similarity": { "min": 0.58, "max": 0.58 },
  "testOnly": false,
  "sharedChanges": 6,
  "changesToAll": 6
}
```

- **When you change one member, change all of them** in the same edit, or say why a copy stays as it is. `sharedChanges` counts the changes that touched at least two members, `changesToAll` the changes that touched every member: a high `changesToAll` means the copies have always been fixed together, so a fix that reaches only one of them is probably incomplete.
- `similarity` is the Jaccard index of the files' five-word runs (identifiers, keywords, and the shape of literals; comments, whitespace, and punctuation do not count), 0..1; a family is built from pairs that are both coupled and at least `thresholds.minCopySimilarity` alike, so the family is connected through those pairs, while `min` and `max` are the weakest and strongest similarity over all pairs of its members. A `min` below the threshold means two members share little: read each member before applying the same edit to it.
- `testOnly: true` marks a family whose members are all test code. Such families come last in `copyFamilies` and are not listed by the terminal; tests that repeat each other are rarely the design problem, so weigh them less.
- A family means "these files change in lockstep", not "something is wrong". One adapter per entity or one config per environment is duplication on purpose; when the same fix keeps landing in all copies, the design move is to extract the shared abstraction. Do not report a family as a bug.
- Only files that already change together are compared, and only from the work tree as it is now: copies that never changed together, files too small to compare, and a coupling between a file and its own test are not families.

## Contract

Stdout carries exactly one JSON document in `--json` mode; diagnostics go to stderr. The documents are versioned by `schemaVersion`: fields may be added in version 1, never renamed or removed. Exit codes: 0 success, 2 usage error, 3 not a git repository or no git, 4 `inspect` matched nothing, 1 anything else. The shapes are defined in [`packages/engine/src/report/`](../packages/engine/src/report/).
