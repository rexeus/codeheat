---
"codeheat": minor
---

Count the commits of one pull request or ticket as one change for coupling, module cohesion, interface churn, breadth, and copy families. Commits belong together when they share a squash-merge `(#123)` suffix or the merge commit that brought them in, or name the same ticket key within 14 days; a pull request of more than 30 commits and a ticket group of more than 50 files or 30 commits are not joined, and mechanical commits never join. `window.couplingCommits`, `sharedCommits`, and the module commit counts now count these changes (fewer, larger units: couplings that only the commits of one pull request shared disappear, and cohesion falls where pull requests reach across modules), while `revisions` stay per commit. The report gains `logicalChanges: { by, count, largest }` (`by` is `pr`, `ticket`, `mixed`, or `commit` when no commits were joined).
