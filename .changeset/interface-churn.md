---
"codeheat": minor
---

Report interface churn against implementation churn per module. Entry points come from `package.json` (`exports`, `main`, `module`, `types`) and conventional files (`index.ts`, `mod.rs`, `lib.rs`, `__init__.py`, …), or from the new repeatable `--entry <glob>` flag of `analyze` and `inspect`. Each module in the JSON report gains `entryPoints`, `interfaceCommits`, `implementationCommits`, and `leakage` (the share of implementation commits that also touched an entry point), and `thresholds` gains `minLeakage` and `minImplementationCommits`. Entry points of a module with a leakage of at least 50% over five implementation commits get a reason line. `analyze` lists the leakiest interfaces in the terminal, and the treemap panel shows a module's entry points and leakage.
