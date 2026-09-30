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
npx codeheat inspect packages/interpret/src/line-work.ts --json
```

```jsonc
{
  "schemaVersion": 1,
  "window": {
    "since": "2025-09-30T06:19:31.076Z",
    "until": "2026-09-30T06:19:31.076Z",
    "commits": 210,
    "couplingCommits": 210,
  },
  "matches": [
    {
      "path": "packages/interpret/src/line-work.ts",
      "rank": 3,
      "of": 273,
      "score": 0.7699,
      "revisions": 17,
      "loc": 221,
      "complexity": { "total": 261, "mean": 1.181, "max": 6 },
      "reasons": [
        "changed in 17 commits (#3 of 273)",
        "indentation complexity 261 (#81 of 273)",
        "co-changes with packages/interpret/src/constants.ts in 71% of its commits",
      ],
      "partners": [
        {
          "path": "packages/interpret/src/constants.ts",
          "sharedCommits": 12,
          "probability": 0.7059,
          "testPair": false,
        },
        {
          "path": "packages/interpret/src/line-network.ts",
          "sharedCommits": 10,
          "probability": 0.5882,
          "testPair": false,
        },
      ],
    },
  ],
  "unmatched": [],
}
```

`probability` reads as: when this file changed, the partner changed too in that share of commits. Globs work, so `inspect "packages/*/src/index.ts"` shows how often public barrels change and what changes with them.

[docs/agents.md](docs/agents.md) has a snippet for `AGENTS.md` / `CLAUDE.md` that makes agents use it.

## Commands

### `codeheat analyze [path]`

| Flag                                  | Default          | Meaning                                                                                                                                               |
| ------------------------------------- | ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `[path]`                              | whole repository | A directory (or file) inside a repository; only files under it are analyzed. Also works for a repository elsewhere: `codeheat analyze ../other-repo`. |
| `--since <when>`                      | `12m`            | History window: `<n>d`, `<n>w`, `<n>m`, `<n>y`, or `YYYY-MM-DD`. Old churn says little about today.                                                   |
| `--include <glob>`                    | language list    | Replaces the built-in list of ~50 source-code extensions. Repeatable.                                                                                 |
| `--exclude <glob>`                    | —                | Removes matching files. Repeatable.                                                                                                                   |
| `--limit <n>`                         | `25`             | Files and couplings in `--json`, each; `0` for all. `totals` always tells the full size.                                                              |
| `--json`                              | off              | One JSON document on stdout; everything else goes to stderr.                                                                                          |
| `--html`, `--out <file>`, `--no-open` | off              | The treemap, see above.                                                                                                                               |

### `codeheat inspect <file-or-glob...>`

Repository-relative paths or globs (quote globs so the shell leaves them alone). The whole repository is analyzed, so ranks and partners stay relative to all files. Takes `--json` and `--since`.

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
- **Test pairs** — `a.ts` with `a.test.ts` is expected coupling; it is marked, never counted as a smell.

The report states every threshold under `thresholds`, and the JSON contract is versioned by `schemaVersion`: new fields may appear, but a field is never renamed or removed without a new version.

## Known limits

- Indentation is a proxy. Unusual formatting distorts it; minified files are excluded for that reason.
- Shallow clones lack history; codeheat warns and ignores the boundary commit. Run `git fetch --unshallow` for full results.
- git gives up on rename detection in very large commits (`diff.renameLimit`), and a path reused after a delete inherits the old file's history, like `git log --follow`.
- Each run reads the history again; there is no cache yet.

## Contributing

See [AGENTS.md](AGENTS.md) for the workflow and rules (`CLAUDE.md` is a symlink to it, so Claude Code and other agents read the same file), [TESTING.md](TESTING.md) for tests, and [docs/](docs/README.md) for everything else. `pnpm install && pnpm check` is the gate.
