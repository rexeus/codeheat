---
"codeheat": patch
---

Count a boundary between two territories once. Its `evidence` now counts each change and each file pair once: `containment` is the share of the changes that touched either territory and stayed inside one of the two (the 35% of one territory is no longer averaged in), `distantPairs` and `hiddenPairs` count the pairs between the two once, and `cliques` counts the cliques that have either as a member. The terminal and the HTML report say "of their changes stay inside one of the two". Every rule is in the glossary.
