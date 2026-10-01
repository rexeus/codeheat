---
"codeheat": minor
---

Split a module that holds most of the code. A module with more than 70% of the files used to stay whole whenever another module existed, so a repository with one package and a small `scripts/` directory (or `src/` beside a small `test/`) had one module that said nothing. It is now cut by directory with the rule that already applied to a repository of a single module, and again while a part still holds more than 70%. A package is split only when it is the only package: the largest of several packages stays one module, however large. The modules of a split package are directory modules, so `package.json` no longer names their entry points; the conventional `index` files still do. The JSON report keeps its shape; `modules`, `FileStats.module`, `crossesModule`, and the cohesion, leakage, and depth figures follow the new boundaries for repositories where the rule applies.
