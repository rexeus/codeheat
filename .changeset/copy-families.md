---
"codeheat": minor
---

Find copy families: files with largely the same content that keep changing in the same commits, the same fix applied to each copy. Among the coupled pairs (a file and its own test excluded), files whose content overlaps by at least half (Jaccard index over runs of five words, comments and formatting ignored) form a family. `analyze --json` lists them in `copyFamilies` with `files`, the `similarity` range, `sharedChanges`, and `changesToAll` (commits that touched every member), `inspect --json` names the family of a file as `copyFamily`, `thresholds.minCopySimilarity` reports the limit, and `--limit` cuts `copyFamilies` like the other lists. Families of test code only are marked `testOnly`, rank last, and stay out of the terminal's list. The terminal shows the first five others under "Copies" and, in `inspect`, a line such as `changes with its 2 copies: …`. A family says the files change in lockstep, not that anything is wrong.
