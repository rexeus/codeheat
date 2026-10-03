---
"codeheat": minor
---

Say where to start. `analyze --json` gains `entryPoints`: at most ten places where the design fails to hold up to the way the code changes, best first, each with a `kind`, the `territories` and `files` it concerns, its `evidence` (named numbers from the territory's fit, the clique, the copy family, or the unstable interface), a fixed-sentence `verdict`, and a `designMove` built from a fixed template with the paths filled in. The report stays schema version 1; the new field is additive.

- `boundary` (move a boundary): a territory at the recommended detail with at least 2% of the heat whose changes mostly reach into other territories (`fit.containment` at most 0.75). The score is `heatShare × (1 − containment) × (chronic ? 1.5 : 1) × (1 + fix share)`.
- `hotspot` (split a hotspot): a territory whose heat is mostly in chronic hotspot files; `files` names up to five of them.
- `clique` (extract a shared abstraction): three or more territories that change as one unit across their boundaries.
- `copies` (extract a shared abstraction): a family of copies that changed in lockstep at least three times.
- `hub` (break up a hub): an unstable interface that changed together with at least three of its dependents.
- `coupling` (centralize a contract): two files in different territories that changed together at least five times although no import links them.

Buckets of smaller folders, loose files, and test-only territories never qualify. Each kind keeps its four best entries and the best entry of every kind is always listed, so the list shows every kind of weakness the repository has; `--limit` does not cut it. The terminal prints them as the first section after the summary, "Where to start", and `inspect` names the entry points a file belongs to (`entryPoints` on every match in `--json`). The rules are in the README and the glossary. The new ranking adds no measurable time to an analysis.
