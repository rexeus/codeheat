---
"codeheat": patch
---

`codeheat analyze --html report.html` now exits 2 and suggests `--out report.html` instead of taking the file name as the path to analyze. It applies to any path ending in `.html` (case-insensitive) when `--html` is given without `--out`; write `./x.html/` to analyze a directory of that name.
