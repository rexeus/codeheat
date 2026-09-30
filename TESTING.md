# Testing

Tests protect behavior while leaving implementations free to change. A green test must give confidence in a promise that matters to a caller — a CLI user, an agent reading the JSON, or the package that consumes a module.

## Choose the narrowest honest level

- **Pure logic** (log parsing, complexity, scoring, coupling, treemap layout, selection): plain Vitest `it` with real values, asserting input to output. Do not wrap pure code in Effect or mock its helpers.
- **Git behavior** (inventory, history, `analyze`): a real temporary git repository built by the engine's `src/testing/` helper, with fixed `GIT_AUTHOR_DATE` and `GIT_COMMITTER_DATE`. Name these files `*.integration.test.ts`; they run in `test:unit` because they only need a local `git`. Never mock `git` output for behavior that git owns (ignore rules, attributes, rename detection).
- **Effect orchestration**: `it.effect` from `@effect/vitest`; control time with `TestClock`. Fake a package-owned `Context.Service` with `Layer.succeed` only where a real dependency cannot produce the state under test.
- **CLI journeys**: run the real command in-process with `Command.runWith` against a temporary repository and a captured `Console`; assert stdout, stderr, and the exit code. Keep these few — they prove wiring, output discipline, and exit-code mapping, not metrics.

## Rules

- **One owner per contract.** Assert each behavior at the level that owns it. A CLI test does not re-verify the scoring formula.
- **Independent expected values.** Derive expectations from a hand-computed literal or the specification, never from the unit under test or the production constants it uses.
- **Assert exact errors.** Check the tagged error (`_tag`) and its fields, not just that something failed.
- **No test-only production surface.** Production modules export nothing only tests use. Shared support lives in `src/testing/`, and every export there has a test caller; knip enforces both.
- **Create state inside the test.** Temporary directories and fakes are made per test and cleaned up by scope or `afterEach`; no shared mutable fixtures.
- **No sleeps, no network, no real user config.** Isolate git from the machine's config (`GIT_CONFIG_GLOBAL=/dev/null`, `GIT_CONFIG_NOSYSTEM=1`) in the repository helper.
- **Names state behavior.** `it("counts revisions of a renamed file under its current path")`, not `it("works")`.
