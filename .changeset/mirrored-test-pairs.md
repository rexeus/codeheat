---
"codeheat": patch
---

Recognize tests mirrored under `test/`, `tests/`, `__tests__/`, `spec/`, `specs/`, or `e2e/` as test pairs of their source (`src/a/b.ts` with `test/a/b.test.ts`, `lib/x.ts` with `__tests__/x.test.ts`), so `Coupling.testPair` is true for them. Fix three bugs found on real repositories: test step files and mocks below a test directory were reported as hubs, a tracked manifest that a `.gitignore` pattern matches was not detected as a package, and a workspace package without files of its own (a folder above its sub-packages) could not be imported by name.
