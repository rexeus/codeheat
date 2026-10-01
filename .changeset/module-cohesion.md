---
"codeheat": minor
---

Group files into modules (workspace packages, otherwise directories) and report how often each module's changes stay inside it. The JSON report gains `modules`, `FileStats.module`, `Coupling.crossesModule`, `totals.modules`, and `thresholds.minModuleCommits`; `inspect` adds the modules of the matched files; `analyze` lists the least cohesive modules in the terminal.
