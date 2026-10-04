---
"codeheat": patch
---

Say the day of the last commit in an empty window. When the HTML report's window has no counted changes, the first screen now reads "The last commit was on 2025-03-14. A longer window, set with --since, would include it." from `window.lastCommitAt`, instead of the span of the latest quarter of the series; a report from an older codeheat without the field keeps the span.
