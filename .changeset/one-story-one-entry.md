---
"codeheat": minor
---

Tell one story once in "Where to start". Two territories that are each other's closest partner (each one's changes most often reach into the other) used to be two entries about the same boundary, often with a clique on top. Now:

- Two `boundary` entries about territories that are each other's `fit.partner` become one `boundary` entry about both: `territories` lists both (the stronger first), the `verdict` is "The boundary between A and B does not hold", the `designMove` "redraw the boundary between A and B, or give what they share a home of its own", and its `score` is the sum of the two. Its `evidence` is that of both together, under the names of a single boundary plus `sharedChanges` (the changes that touched both), and its `findings` list that finding first, then the boundary of each territory.
- A `boundary` entry all of whose territories are members of a higher ranked `clique` entry is no entry of its own; its findings follow the clique's in the clique's `findings`.

`analyze --json` stays at schema version 1. Every entry of `findings` gains `territories`, the ids it is about, and the `verdict` of a `boundary` entry about two territories now names both paths instead of being a fixed sentence. The terminal prints a further finding about other territories than its entry's as "Also boundary of <path>".
