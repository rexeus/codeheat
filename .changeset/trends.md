---
"codeheat": minor
---

`codeheat analyze --compare <duration>` compares the latest window of that length with the one before it and reports how hotspots and module cohesion moved. Combining it with `--since` is a usage error (exit 2).

The JSON report gains `comparison` (the previous window with `previousCommits` and `previousTruncated`), `FileStats.trend` (`previousScore`, `previousRevisions`, `scoreDelta`, `newlyActive`), `FileStats.test`, and `Module.trend` (`previousCohesion`, `cohesionDelta`, only for modules with enough commits in both windows). The trends and `comparison` are `null` without `--compare`. Scores are normalized within each window, so a delta shows a shift in standing among the files. The terminal view adds a "Biggest changes" section with the five source files that got hotter most, the three highest-ranked newly active source files, and the five modules whose cohesion moved most. Test files are left out, and a file with no revisions in the previous window is newly active, not warming. The treemap gains a third color mode, Change (`#mode=change`), from cooler to warmer; newly active files and files without data are hatched. An empty or cut-off previous window is reported as such, in the terminal and, for a shallow clone, on stderr.
