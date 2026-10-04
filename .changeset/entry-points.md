---
"codeheat": minor
---

Say where to start. `analyze --json` gains `entryPoints`: at most ten places where the design fails to hold up to the way the code changes, best first, each with a `kind`, the `territories` and `files` it concerns, its `evidence` (named numbers), a fixed-sentence `verdict`, a `designMove` built from a fixed template with the paths filled in, and `findings` (every finding about the entry, the stronger first). The report stays schema version 1; the new field is additive.

- `boundary` (move a boundary): a territory at the recommended detail with at least 2% of the heat of which at most 75% of the changes stay inside (`fit.containment` at most 0.75).
- `hotspot` (split a hotspot): a territory at least half of whose heat is in chronic hotspot files, contained or not; `files` names up to five of them.
- `clique` (extract a shared abstraction): three or more territories that change as one unit across their boundaries.
- `copies` (extract a shared abstraction): a family of copies that changed in lockstep at least three times.
- `hub` (break up a hub): an unstable interface that changed together with at least three of its dependents.
- `coupling` (centralize a contract): two files in different territories that changed together at least five times although no import links them.

Every score is a share of the heat at stake times how strong the weakness is, so scores of different kinds compare as the share of change effort at stake. A territory that is both a boundary and a hotspot is one entry with two findings. The best entry of every kind that qualifies is always listed; the gates are reported under `thresholds` (`minEntryHeatShare`, `maxEntryContainment`, `minEntryChronicShare`, `minEntryChanges`, `minEntryCouplingChanges`, `minEntryScore`, `maxEntriesPerKind`, `maxEntries`). Every entry scores at least 0.5% of the change effort, and each kind keeps its six best. Buckets of smaller folders, loose files, and test-only territories never qualify, and `--limit` does not cut the list (a file an entry names may be missing from the cut `files`; use `inspect` or `--limit 0`). The terminal prints the entries as the first section after the summary, "Where to start", and `inspect` names the entry points a file belongs to (`entryPoints` on every match in `--json`) and gives the file's territory and the one it changes with most, with their fit (`territories` in `--json`). The rules are in one table in the README and the glossary. The ranking adds no measurable time to an analysis.
