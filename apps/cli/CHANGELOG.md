# codeheat

## 0.1.0

### Minor Changes

- d3c76bd: Add the `analyze` and `inspect` commands. `codeheat analyze [path]` prints the top hotspots and change couplings of a git repository, or the full ranked report with `--json`; `--since`, `--include`, `--exclude` and `--limit` shape the analysis and its output. `analyze` accepts a directory or a single file, warns on stderr about shallow clones, and never follows symlinks. `codeheat inspect <file-or-glob...>` shows the rank, metrics and co-change partners of files before you edit them. Exit codes: 0 success, 1 unexpected error, 2 usage error, 3 not a git repository or git missing, 4 `inspect` matched nothing.
- 9d07ead: Add `codeheat analyze --html`: a self-contained treemap (area = lines of code, color = hotspot rank) that opens in the browser. Click a file to see why it is hot and which files change with it; filter by path or glob. `--out <file>` chooses where it is written, `--no-open` skips the browser.
