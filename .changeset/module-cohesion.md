---
"codeheat": minor
---

Group files into modules (workspace packages, otherwise directories) and report how often each module's changes stay inside it. The JSON report gains `modules`, `FileStats.module`, `Coupling.crossesModule`, `totals.modules`, and `thresholds.minModuleCommits` (1% of the counted commits, at least 5); each module says whether it is `testOnly`, and `modules` lists the ranked ones first. `inspect` adds the modules of the matched files and marks partners in another module with `crossesModule`; `analyze` lists the least cohesive modules in the terminal, and the treemap can color tiles by module cohesion.
