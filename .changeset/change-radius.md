---
"codeheat": minor
---

Report how far a change spreads. `analyze --json` gains two fields:

- `changeRadius`: how many modules the counted changes (logical changes, like cohesion) touched, as the `median` (the modules a typical change touches), `p90` (nine in ten changes touch at most that many), `local` (the share that stays in one module), and the number of measured `changes`. Test-only modules are left out of every change, since the test of a change is no spread, and a change that touched no other module is not measured. It depends on the detected modules: finer modules give a larger radius.
- `propagationCost`: the mean share of the other files a file reaches through chains of at most three couplings (the reported `couplings`, so at least 3 shared changes and a degree of 0.3), over the files that are not test code and took part in at least 3 counted changes (large changes are not counted), together with the number of `files` it ran over. 0 means no file is coupled, 1 that everything reaches everything; the depth limit keeps dense graphs from saturating. `thresholds.propagationDepth` reports the limit. The cost shrinks as the number of regularly changing files grows, so it is meant to be compared within one repository over time, not between repositories; the terminal does not show it.

Each module gains `radius`, the median number of modules touched by the counted changes that touch it (1 means its changes usually stay inside), which `inspect` shows with the file's module. The terminal prints one sentence under the summary line, for example "Across 170 changes, a typical change touches 1 module; 9 in 10 touch at most 3 modules; 64% stay in one module." Both new report fields are `null` where there is no data.
