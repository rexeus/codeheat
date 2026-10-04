---
"codeheat": minor
---

Divide the code into territories. `analyze --json` gains `territories`, a tree of non-overlapping areas of the code that a reader can take at up to six levels of detail, with a one-line description of each. The report stays schema version 1; the new fields are additive and `modules` is unchanged.

- `territories.nodes`: every area with its `path`, `kind` (`package`, `folder`, `group` of sibling folders that keep changing together, `tests` for test code that belongs to no code, or `other` for loose files and a bucket of smaller folders), its `parent` and `children`, the number of `files` (and `testFiles`), the counted `changes` that touched it, its `heatShare`, and a `splitReason` in plain words for every area that splits into smaller ones.
- `territories.details` lists the areas visible at each level (1 is the first cut by top-level folders, up to 6), and `territories.recommended` names the finest level with at most 25 territories in which no bucket holds a folder of at least 1% of all heat that is hotter than a territory opened beside it (else the finest with at most 25); buckets and test-only areas never count for it and sort last. An area splits when it is too big or when its folders change independently; folders whose changes largely coincide stay together, and at most 8 children open at once, the hottest first, so a hot folder is not left in the bucket.
- `description` is the manifest's `description` (`package.json`, `Cargo.toml`, `pyproject.toml`, `pom.xml`), else the first sentence of the README, else `main files: a, b, c`, the most changed files. It is one line without control characters, at most 160 characters.
- Test code counts for the territory of the code it tests (a test paired with a source file, including Maven and Gradle layouts, or below a test directory beside code), so tests no longer pull heat away from the code they check; when that code is split into several territories its tests form a `tests` territory beside them.
- `FileStats.territory` names the finest territory of every file.

The terminal prints one line under the summary: how many territories the recommended detail has. The default run costs no measurable time more.
