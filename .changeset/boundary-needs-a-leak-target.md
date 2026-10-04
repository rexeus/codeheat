---
"codeheat": patch
---

Name the leak before calling a boundary broken. A `boundary` entry point now needs a leak target: the territory has to have a `fit.partner` (another territory that shares at least `thresholds.minSharedCommits` changes with it), besides the changes and the heat it already needed. A territory that keeps little inside but shares changes with no other territory, such as one in a repository with very few changes, is no longer listed as a place to start, and its move always names the territory to start with. No field changes.
