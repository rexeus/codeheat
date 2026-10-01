---
"codeheat": minor
---

`codeheat analyze --compare <duration>` compares the latest window of that length with the one before it and reports how hotspots and module cohesion moved. Combining it with `--since` is a usage error (exit 2).

The JSON report gains `comparison` (the previous window), `FileStats.trend` (`previousScore`, `scoreDelta`, `newlyActive`) and `Module.trend` (`previousCohesion`, `cohesionDelta`), all `null` without `--compare`. Scores are normalized within each window, so a delta shows a shift in standing among the files. The terminal view adds a "Biggest changes" section with the five source files that got hotter most, the three highest-ranked newly active source files, and the five modules whose cohesion moved most. Test files are left out, and a file with no revisions in the previous window is newly active, not warming. The treemap gains a third color mode, Change (`#mode=change`), from cooler to warmer; newly active files are drawn like files without data.
