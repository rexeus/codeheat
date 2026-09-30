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

## Contract

Stdout carries exactly one JSON document in `--json` mode; diagnostics go to stderr. The documents are versioned by `schemaVersion`: fields may be added in version 1, never renamed or removed. Exit codes: 0 success, 2 usage error, 3 not a git repository or no git, 4 `inspect` matched nothing, 1 anything else. The shapes are defined in [`packages/engine/src/report/`](../packages/engine/src/report/).
