---
"codeheat": minor
---

Tell a boundary and the clique around it as one story, whichever ranks higher. A `boundary` entry whose territories are all members of a `clique` entry used to be folded only into a higher ranked clique; now a boundary also takes in a lower ranked clique, but only when it is a boundary between two territories and the clique has at most three members (the two and one more); a larger clique is the bigger story and stays its own entry, and a clique still takes in any boundary entry it outranks (the boundary leads on a tie). A boundary entry that took in a clique keeps its `kind`, `territories`, and numbers and lists the clique's finding after its own (`findings[].territories` names the members). The report stays schema version 1.
