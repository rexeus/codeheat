---
"codeheat": minor
---

Put the verdict in the report. `analyze --json` gains `verdict`, the answer the HTML report shows beside its question: `level` (`holds`, `mixed`, `strained`, or `unknown`), the `reason` for `unknown` (`no-territories`, `quiet-window`, `too-little-evidence`), `leakShare` and `coverage` (the shares of all the heat in leaking and in judged territories), the `judged` and `leaking` territory ids, and whether an `eroding` trend lowered it. `thresholds` gains its cut points, `minVerdictCoverage` (0.5), `minMixedLeakShare` (0.2), and `minStrainedLeakShare` (0.5). The rule is the one the page used, so agents reading the JSON get the same answer as the page. The report stays schema version 1; the new fields are additive.
