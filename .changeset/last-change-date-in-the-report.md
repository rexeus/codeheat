---
"codeheat": patch
---

Say the day of the newest commit in an empty window. When the HTML report's window has no counted changes, the first screen reads "The newest commit of the repository was on 2025-03-14, before this window starts. A longer window, set with --since, reaches back to it." from `window.lastCommitAt`, or that the window's commits are mechanical and do not count. A newest commit inside a window that holds no commit at all (a documentation-only commit, a scoped analysis) says nothing about the analysed code, so the first screen keeps the span of the latest quarter of the series with counted changes, as it does for a report from an older codeheat without the field.
