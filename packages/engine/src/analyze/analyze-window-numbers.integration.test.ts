import { NodeServices } from "@effect/platform-node";
import { assert, layer } from "@effect/vitest";
import { Effect } from "effect";
import { TestClock } from "effect/testing";

import { analyzeOptionsFor } from "../testing/analyze-options.js";
import { makeTempRepository } from "../testing/temp-repository.js";
import { analyze } from "./analyze.js";

// The window is the 12 months from 2025-06-01, the series the 24 from 2024-06-01:
// the commits of 2024 and early 2025 are read for the series only.
const setNow = TestClock.setTime(Date.parse("2026-06-01T12:00:00Z"));

const BEFORE = "a\nb\nc\n";
const AFTER = "a\nb\nc\nx\n";

layer(NodeServices.layer)(
  "analyze window numbers beside a longer series",
  (it) => {
    it.effect(
      "judges a copy of a patch against the copies inside the window, not against one that was backed out and landed again earlier",
      () =>
        Effect.gen(function* () {
          yield* setNow;
          const repo = yield* makeTempRepository;
          yield* repo.git("symbolic-ref", "HEAD", "refs/heads/main");
          yield* repo.commit(
            "2024-11-01T12:00:00Z",
            { "f.ts": BEFORE },
            "chore: create",
          );
          yield* repo.commit(
            "2024-12-01T12:00:00Z",
            { "f.ts": AFTER },
            "feat: add x",
          );
          yield* repo.commit(
            "2025-01-01T12:00:00Z",
            { "f.ts": BEFORE },
            "undo x",
          );
          yield* repo.git("checkout", "--quiet", "-b", "side");
          yield* repo.git("checkout", "--quiet", "main");
          yield* repo.commit(
            "2025-07-01T12:00:00Z",
            { "f.ts": AFTER },
            "feat: add x again",
          );
          yield* repo.git("checkout", "--quiet", "side");
          yield* repo.commit(
            "2025-08-01T12:00:00Z",
            { "f.ts": AFTER },
            "feat: add x on the side",
          );
          yield* repo.git("checkout", "--quiet", "main");
          yield* repo.gitAt(
            "2025-09-01T12:00:00Z",
            "merge",
            "--no-ff",
            "--quiet",
            "--message",
            "Merge branch 'side'",
            "side",
          );

          const report = yield* analyze(analyzeOptionsFor(repo));

          // read on its own, the window holds a patch and a cherry-pick of it on a parallel line
          assert.strictEqual(report.window.commits, 2);
          assert.strictEqual(report.window.realCommits, 1);
          assert.strictEqual(report.mechanicalCommits.duplicates, 1);
          assert.strictEqual(report.files[0]?.revisions, 1);
        }),
    );
  },
);

layer(NodeServices.layer)(
  "analyze window numbers and the pull requests of the series",
  (it) => {
    it.effect(
      "groups the commits of a pull request that an old squash commit on its branch would have kept apart",
      () =>
        Effect.gen(function* () {
          yield* setNow;
          const repo = yield* makeTempRepository;
          yield* repo.git("symbolic-ref", "HEAD", "refs/heads/main");
          yield* repo.commit(
            "2024-11-01T12:00:00Z",
            { "a.ts": BEFORE, "b.ts": BEFORE, "c.ts": BEFORE },
            "chore: create",
          );
          yield* repo.git("checkout", "--quiet", "-b", "feature");
          yield* repo.commit(
            "2024-12-01T12:00:00Z",
            { "c.ts": AFTER },
            "feat: old work (#12)",
          );
          yield* repo.commit(
            "2025-07-01T12:00:00Z",
            { "a.ts": AFTER },
            "feat: part one",
          );
          yield* repo.commit(
            "2025-08-01T12:00:00Z",
            { "b.ts": AFTER },
            "feat: part two",
          );
          yield* repo.git("checkout", "--quiet", "main");
          yield* repo.gitAt(
            "2025-09-01T12:00:00Z",
            "merge",
            "--no-ff",
            "--quiet",
            "--message",
            "Merge pull request #13 from org/feature",
            "feature",
          );

          const report = yield* analyze(analyzeOptionsFor(repo));

          // read on its own, the window holds the two commits of pull request 13, which is one change
          assert.strictEqual(report.window.commits, 2);
          assert.deepStrictEqual(
            [report.logicalChanges.by, report.logicalChanges.count],
            ["pr", 1],
          );
          assert.strictEqual(report.window.couplingCommits, 1);
        }),
    );
  },
);
