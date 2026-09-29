# Glossary

**Universe** — the set of files an analysis considers code: tracked by git, not ignored, not marked `linguist-generated` or `linguist-vendored`, not binary or minified, and matching the language allow-list or the `--include` globs. Scores and coupling are relative to the universe.

**Focus** — the files a question is about (`inspect <file-or-glob...>`). Focus narrows what is reported, never the universe.

**Analysis window** — the time range of history considered (`--since`, default 12 months), resolved to absolute dates in the report.

**Revisions** — the number of non-merge commits in the analysis window that touched a file, following renames. The churn signal.

**Indentation complexity** — the sum of logical indentation levels over a file's non-blank lines. A language-agnostic proxy for structural complexity.

**Hotspot** — a file that is both complex and frequently changed. Its **score** (0..1) is the product of its log-max-normalized revisions and indentation complexity.

**Change coupling** — two files that repeatedly change in the same commits. Coupling across distant directories signals a missing or misplaced module boundary.

**Coupling degree** — `shared commits / mean(revisions of both files)`, 0..1. Symmetric; ranks coupled pairs.

**Co-change probability** — `shared commits / revisions of the focused file`. Directional: how likely a change to this file also changes the partner.

**Test pair** — a coupled pair where one file is the other's test (`a.ts` and `a.test.ts`). Expected coupling, never a modularization smell.
