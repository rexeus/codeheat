---
"codeheat": minor
---

Count test support directories as test code: a file below a directory named `testing`, `test-utils`, `test-helpers`, `__mocks__`, `mocks`, or `__snapshots__` is now test code like one below `test` or `fixtures` (a contract file stays a contract). Such files are no longer hub candidates, are marked `FileStats.test`, count as test code in copy families (`testOnly`), leave `distantCouplings` and `unstableInterfaces`, and do not count as implementation lines in a module's `depth` or as implementation commits; a module made only of them is test-only, and a package of them no longer counts as another package when a repository's modules are split. A production package or folder that happens to carry one of these names is read as test code too; `--exclude` cannot override that yet.
