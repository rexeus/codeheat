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

**Module** — the unit the report groups universe files into. A **package** is a directory, other than the repository root, with a tracked manifest (`package.json`, `go.mod`, `Cargo.toml`, `pyproject.toml`, `pom.xml`, `build.gradle`, `build.gradle.kts`, or `*.csproj`); a file belongs to its nearest enclosing package. Files outside every package form **directory** modules, cut at the first depth where they split into at least two directories (at the first level when no depth does); root files form `.`. When that leaves fewer than two modules, all files are regrouped by directory. There is no size floor: every package is a module.

**Cohesion** — of a module, `commits touching only this module / commits touching it`, over counted commits; `null` without counted commits. Its **partners** are the other modules those commits touched, most shared commits first. A coupling that **crosses a module** joins files of different modules; that is stated neutrally, since an app legitimately changes with the library it uses. A module is **ranked** when it has at least `minModuleCommits` counted commits (`max(5, ceil(1% × couplingCommits))`) and is not **test-only**; the report, terminal, and viewer list ranked modules first, least cohesive first.

**Test code** — a file whose name has a test suffix (`.test`, `.spec`, `_test`, `_spec`) or that lies below a directory named `test`, `tests`, `__tests__`, `spec`, `specs`, `e2e`, `fixtures`, or `__fixtures__`. A **test-only module** (`Module.testOnly`) consists of test code alone. Never ranked: its cohesion says nothing about the design.

**Entry point** — a file that makes up a module's public interface. For a package: the files its `package.json` names in `exports`, `main`, `module`, or `types`, counting only JavaScript and TypeScript files and no `*.config.*` files (a `*` in a target matches any files, a target without extension finds the file with that name, and a `dist/` or `build/` target stands for the same-stem source under the module when one exists) and the conventional `index.{ts,tsx,mts,cts,js,jsx,mjs,cjs}`, `mod.rs`, `lib.rs`, `__init__.py` at the module root or its `src/`; for a directory module only the conventional files. `--entry <glob>` replaces detection. Its **interface commits** are the counted commits that touched an entry point; its **implementation commits** those that touched any other file of the module that is not test code.

**Leakage** — of a module, `implementation commits that also touched an entry point / implementation commits`, 0..1; `null` without entry points or implementation commits. High leakage means changes inside the module keep changing its public API (a shallow or leaky module). A module is a **leaky interface** (`Module.leakyInterface`) when it is not test-only and its leakage is at least `minLeakage` over at least `minImplementationCommits` implementation commits; its entry points that changed in a commit that also changed the implementation get a reason. Unlike the cohesion ranking, that commit floor does not grow with the window: it only keeps a share of a handful of commits from counting. Low leakage behind an `export *` barrel does not prove a stable API, and an entry file that holds most of a module's code inflates leakage.

**Comparison window** — with `--compare <duration>`, the window of the same length that ends where the analysis window starts. Both are read in one pass over the history and measured over the same universe, with the same fixed limits (such as `maxCommitFiles`); `minModuleCommits` is derived per window, and the report's thresholds are the analysis window's. The report describes the analysis window, the comparison window only feeds the trends. The comparison window is **truncated** when it reaches back past the oldest commit of the repository or of a shallow clone, and **empty** (`previousCommits` 0) when no commit touched the universe in it: there is then nothing to compare.

**Trend** — how a file or module moved between the comparison window and the analysis window. A file's **score delta** is its score now minus its score then, each normalized within its own window, so it shows a shift in standing among the files rather than a change in raw revisions; a module's **cohesion delta** is the change in its cohesion, positive when it became more self-contained. A file with no revisions in the comparison window but some now is **newly active** (`trend.newlyActive`): its score delta is just its score, so it is never ranked as warming. A module's trend needs at least `minModuleCommits` counted commits in both windows. A trend is `null` without `--compare`, and where a window has no data to compare. The treemap draws it as _cooler_ (score fell) to _warmer_ (score rose).

**Import relation** — of a coupled pair, whether a static import links the two files: `Coupling.imports` is `a→b` when `a` imports `b`, `b→a`, `both`, or `none`; `null` when unknown. A file imports another when it names it in a static `import`, `export … from`, a dynamic `import()` with a plain string, or a `require()`, or imports a module that re-exports it (transitively). Relative specifiers and workspace package names resolve to universe files; everything else links nothing. In an `inspect` partner the same relation is seen from the inspected file (`file→partner`, `partner→file`). Unknown (`null`) is a file that is not TypeScript or JavaScript, does not parse, or lies behind an unavailable parser; it is never `none`.

**Hidden coupling** — a coupled pair whose import relation is `none`: the files change together without referring to each other, so the shared contract (duplicated logic, a protocol, configuration read twice) is invisible in the code. A file whose strongest non-test partner is hidden with a co-change probability of at least `minHiddenProbability` (0.5) gets a reason line. Test pairs are never called hidden. It can overstate where imports go through aliases such as tsconfig `paths`, which are not resolved.

**Language adapter** — the engine's seam to a language: one small adapter per language, selected by file extension, that lists what a file imports. Only the TypeScript and JavaScript adapter exists; the CLI injects its parser (`oxc-parser`), so the engine depends on no parser.
