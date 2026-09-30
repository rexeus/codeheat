# Glossary

**Universe** — the set of files an analysis considers code: a regular file tracked by git (no symlink or submodule), not ignored, not marked `linguist-generated` or `linguist-vendored`, not binary or minified, and matching the language allow-list or the `--include` globs. Scores and coupling are relative to the universe.

**Focus** — the files a question is about (`inspect <file-or-glob...>`). Focus narrows what is reported, never the universe.

**Analysis window** — the time range of history considered (`--since`, default 12 months), resolved to absolute dates in the report.

**Revisions** — the number of non-merge commits in the analysis window that touched a file, following renames. The churn signal. A shallow clone lacks the history before its oldest commit, so its revisions undercount.

**Indentation complexity** — the sum of logical indentation levels over a file's non-blank lines. A language-agnostic proxy for structural complexity.

**Weighted lines** — a file's size as the score sees it: every non-blank line counts 1 plus its indentation level, so flat files (barrels) keep their weight and nesting adds to it.

**Hotspot** — a file that is both large or complex and frequently changed. Its **score** (0..1) is the product of its log-max-normalized revisions and weighted lines.

**Change coupling** — two files that repeatedly change in the same commits. Coupling across distant directories signals a missing or misplaced module boundary.

**Coupling degree** — `shared commits / mean(revisions of both files)`, 0..1. Symmetric; ranks coupled pairs.

**Co-change probability** — `shared commits / revisions of one file of the pair`. Directional: how likely a change to that file also changes the other. `inspect` shows it for the focused file, `analyze` for both files of a pair.

**Test pair** — a coupled pair where one file is the other's test (`a.ts` and `a.test.ts`). Expected coupling, never a modularization smell.
