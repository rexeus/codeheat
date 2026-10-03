import { NodeServices } from "@effect/platform-node";
import { assert, layer } from "@effect/vitest";
import { Effect } from "effect";

import {
  lines,
  pathsOfChanges,
  readChanges,
  startOn,
} from "../testing/logical-changes.js";
import { makeTempRepository } from "../testing/temp-repository.js";

layer(NodeServices.layer)(
  "readHistory logical changes by ticket within the span",
  (it) => {
    it.effect(
      "joins commits that name one ticket within 14 days of the first",
      () =>
        Effect.gen(function* () {
          const repo = yield* makeTempRepository;
          yield* startOn(repo, ["a.ts", "b.ts", "c.ts"]);
          yield* repo.commit(
            "2026-03-01T12:00:00Z",
            { "a.ts": lines(4, "a1") },
            "PROJ-42 add the endpoint",
          );
          yield* repo.commit(
            "2026-03-15T12:00:00Z",
            { "b.ts": lines(4, "b1") },
            "[PROJ-42] wire it up",
          );
          yield* repo.commit(
            "2026-03-15T13:00:00Z",
            { "c.ts": lines(4, "c1") },
            "PROJ-42: a fix an hour after the span",
          );

          const result = yield* readChanges(repo, ["a.ts", "b.ts", "c.ts"]);

          assert.deepStrictEqual(pathsOfChanges(result), [
            ["a.ts", "b.ts"],
            ["c.ts"],
          ]);
          assert.deepStrictEqual(result.logicalChanges, {
            by: "ticket",
            count: 2,
            largest: 2,
          });
        }),
    );
  },
);

layer(NodeServices.layer)(
  "readHistory logical changes by ticket after the span",
  (it) => {
    it.effect("keeps commits apart when the ticket comes back much later", () =>
      Effect.gen(function* () {
        const repo = yield* makeTempRepository;
        yield* startOn(repo, ["a.ts", "b.ts"]);
        yield* repo.commit(
          "2026-03-01T12:00:00Z",
          { "a.ts": lines(4, "a1") },
          "PROJ-7 first",
        );
        yield* repo.commit(
          "2026-04-01T12:00:00Z",
          { "b.ts": lines(4, "b1") },
          "PROJ-7 again",
        );

        const result = yield* readChanges(repo, ["a.ts", "b.ts"]);

        assert.deepStrictEqual(pathsOfChanges(result), [["a.ts"], ["b.ts"]]);
        assert.strictEqual(result.logicalChanges.by, "commit");
      }),
    );
  },
);

layer(NodeServices.layer)(
  "readHistory logical changes by ticket lookalikes",
  (it) => {
    it.effect("ignores words that only look like a ticket key", () =>
      Effect.gen(function* () {
        const repo = yield* makeTempRepository;
        yield* startOn(repo, ["a.ts", "b.ts"]);
        yield* repo.commit(
          "2026-03-01T12:00:00Z",
          { "a.ts": lines(4, "a1") },
          "fix: read UTF-8 files",
        );
        yield* repo.commit(
          "2026-03-02T12:00:00Z",
          { "b.ts": lines(4, "b1") },
          "fix: write UTF-8 files",
        );

        const result = yield* readChanges(repo, ["a.ts", "b.ts"]);

        assert.deepStrictEqual(pathsOfChanges(result), [["a.ts"], ["b.ts"]]);
      }),
    );
  },
);

layer(NodeServices.layer)(
  "readHistory logical changes by ticket across pull requests",
  (it) => {
    it.effect("joins pull requests that share a ticket and says so", () =>
      Effect.gen(function* () {
        const repo = yield* makeTempRepository;
        yield* startOn(repo, ["a.ts", "b.ts", "c.ts"]);
        yield* repo.commit(
          "2026-03-01T12:00:00Z",
          { "a.ts": lines(4, "a1") },
          "PROJ-1 part one (#20)",
        );
        yield* repo.commit(
          "2026-03-01T13:00:00Z",
          { "b.ts": lines(4, "b1") },
          "PROJ-1 part one, tidied (#20)",
        );
        yield* repo.commit(
          "2026-03-05T12:00:00Z",
          { "c.ts": lines(4, "c1") },
          "PROJ-1 part two (#21)",
        );

        const result = yield* readChanges(repo, ["a.ts", "b.ts", "c.ts"]);

        assert.deepStrictEqual(pathsOfChanges(result), [
          ["a.ts", "b.ts", "c.ts"],
        ]);
        assert.deepStrictEqual(result.logicalChanges, {
          by: "mixed",
          count: 1,
          largest: 3,
        });
      }),
    );
  },
);

layer(NodeServices.layer)(
  "readHistory logical changes by ticket limits",
  (it) => {
    it.effect(
      "does not join a ticket's commits into a change of more than 50 files",
      () =>
        Effect.gen(function* () {
          const repo = yield* makeTempRepository;
          const universe = Array.from(
            { length: 60 },
            (_, index) => `f${index}.ts`,
          );
          yield* startOn(repo, universe);
          for (const [day, from] of [
            ["01", 0],
            ["02", 20],
            ["03", 40],
          ] as const) {
            yield* repo.commit(
              `2026-03-${day}T12:00:00Z`,
              Object.fromEntries(
                universe
                  .slice(from, from + 20)
                  .map((file) => [file, lines(4, `${file} ${day}`)]),
              ),
              "PROJ-9 migrate a slice",
            );
          }

          const result = yield* readChanges(repo, universe);

          assert.deepStrictEqual(
            result.changes.map(({ files }) => files.length),
            [20, 20, 20],
          );
          assert.strictEqual(result.logicalChanges.by, "commit");
        }),
    );
  },
);

layer(NodeServices.layer)(
  "readHistory logical changes by ticket and mechanical commits",
  (it) => {
    it.effect("never joins a mechanical commit to a change", () =>
      Effect.gen(function* () {
        const repo = yield* makeTempRepository;
        yield* startOn(repo, ["a.ts", "b.ts", "c.ts"]);
        yield* repo.commit(
          "2026-03-01T12:00:00Z",
          { "a.ts": lines(4, "a1") },
          "PROJ-3 edit a",
        );
        yield* repo.git("mv", "c.ts", "d.ts");
        yield* repo.commit("2026-03-02T12:00:00Z", {}, "PROJ-3 move c to d");
        yield* repo.commit(
          "2026-03-03T12:00:00Z",
          { "b.ts": lines(4, "b1") },
          "PROJ-3 edit b",
        );

        const result = yield* readChanges(repo, ["a.ts", "b.ts", "d.ts"]);

        assert.deepStrictEqual(pathsOfChanges(result), [["a.ts", "b.ts"]]);
        assert.strictEqual(result.mechanical.renames, 1);
        assert.deepStrictEqual(result.logicalChanges, {
          by: "ticket",
          count: 1,
          largest: 2,
        });
      }),
    );
  },
);
