---
"codeheat": minor
---

Say which territories change together. `analyze --json` gains `territoryCoupling` and `territoryCliques`, both for the recommended detail only. `territoryCoupling` lists each pair of the 24 hottest real territories that share at least three counted changes, once (`a` sorts before `b` by id), with `sharedChanges` (counted by the code behind `fit.partner`), `distantPairs` (coupled file pairs between the two) and `hiddenPairs` (of those, the pairs no import links). `territoryCliques` lists the groups of three or more territories that change as one unit, with their ids, `sharedChanges`, `weakestShare`, `heatShare`, and `codeHeatShare`, the numbers an entry point of kind `clique` is scored on. `--limit` does not cut either. The report stays schema version 1; the new fields are additive, and v2 will move them under `coupling`.
