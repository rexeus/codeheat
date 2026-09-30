---
"codeheat": minor
---

Add the `analyze` and `inspect` commands. `codeheat analyze [path]` prints the top hotspots and change couplings of a git repository, or the full ranked report with `--json`; `--since`, `--include`, `--exclude` and `--limit` shape the analysis and its output. `codeheat inspect <file-or-glob...>` shows the rank, metrics and co-change partners of files before you edit them. Exit codes: 0 success, 1 unexpected error, 2 usage error, 3 not a git repository or git missing, 4 `inspect` matched nothing.
