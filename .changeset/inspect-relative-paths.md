---
"codeheat": patch
---

`inspect` resolves a path without glob characters against the working directory, so `codeheat inspect b.ts` works from a subdirectory. Absolute paths work too; globs stay repository-relative.
