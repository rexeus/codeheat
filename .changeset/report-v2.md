---
"codeheat": major
---

Report v2. (Placeholder: the bump is pending the owner's decision; until then this changeset collects the changes of the v2 release.)

- Heat a file only for the changes that are counted. A logical change of more than `thresholds.maxCommitFiles` (50) files already said nothing about coupling, cohesion, or a territory's `changes`; it now adds nothing to a file's `changes` (`FileStats.changes`, `ContractFile.changes`) and so nothing to its heat (`changes × (loc + complexity.total)`) either. Heat shares, the verdict's `leakShare`, coupling degrees, co-change probabilities, and the hub and unstable-interface gates now rest on the same changes as a territory's `changes` and `fit.containment`, so a sweeping refactor no longer heats the files it touched.
