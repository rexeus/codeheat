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

**Test pair** — a coupled pair where one file is the other's test (`a.ts` and `a.test.ts`; the suffixes `.test`, `.spec`, `_test`, and `_spec` count). Expected coupling, never a modularization smell.

**Co-change breadth** — the number of distinct other universe files a file changed together with in counted commits (at most `maxCommitFiles` files each), however rarely. A **hub** is a hub candidate (at least `hubMinRevisions` revisions, not a test file) whose breadth is at least `hubMinBreadth` and among the widest `hubTopShare` of the candidates, ties at the cut-off included; it is explained with a reason line, even when no single pair is coupled strongly enough to report.

**Module** — the unit the report groups universe files into. A **package** is a directory, other than the repository root, with a tracked manifest (`package.json`, `go.mod`, `Cargo.toml`, `pyproject.toml`, `pom.xml`, `build.gradle`, `build.gradle.kts`, or `*.csproj`); a file belongs to its nearest enclosing package. Files outside every package form **directory** modules, cut at the first depth where they split into at least two directories; root files form `.`. When that leaves fewer than two modules, all files are regrouped by directory. There is no size floor: every package is a module.

**Cohesion** — of a module, `commits touching only this module / commits touching it`, over counted commits; `null` without counted commits. Its **partners** are the other modules those commits touched, most shared commits first. A coupling that **crosses a module** joins files of different modules; that is stated neutrally, since an app legitimately changes with the library it uses. Modules below `minModuleCommits` counted commits are not ranked in terminal views.
