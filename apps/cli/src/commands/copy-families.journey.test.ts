import { InspectResult, Report } from "@codeheat/engine";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Schema } from "effect";

import { journey } from "../testing/journey-harness.js";
import { makeCopyProject } from "../testing/projects.js";

// Real clock: the analysis window is resolved against now, and the commits are dated relative to it.
describe("codeheat finds copy families", () => {
  it.live("lists the family in the terminal view of analyze", () =>
    Effect.gen(function* () {
      const repo = yield* makeCopyProject;

      const result = yield* journey({ args: ["analyze"], cwd: repo.root });

      expect(result.exitCode).toBe(0);
      const lines = result.stdout.split("\n");
      const start = lines.indexOf(
        "Copies (similar files that change in lockstep)",
      );
      expect(lines.slice(start, start + 4)).toStrictEqual([
        "Copies (similar files that change in lockstep)",
        "copies  similar  shared  all  files",
        "     3      70%       4    4  lib/billing/handler.ts, src/orders/handler.ts, src/users/handler.ts",
        "shared: commits that touched two or more copies; all: commits that touched every copy",
      ]);
    }).pipe(Effect.scoped),
  );

  it.live("names the copies of an inspected file", () =>
    Effect.gen(function* () {
      const repo = yield* makeCopyProject;

      const result = yield* journey({
        args: ["inspect", "src/orders/handler.ts"],
        cwd: repo.root,
      });

      expect(result.stdout).toContain(
        "changes with its 2 copies: lib/billing/handler.ts, src/users/handler.ts (4 commits touched at least two of the 3 files, 4 touched all of them)",
      );
    }).pipe(Effect.scoped),
  );
});

describe("codeheat reports copy families as JSON", () => {
  it.live("adds the families to the report and to inspect", () =>
    Effect.gen(function* () {
      const repo = yield* makeCopyProject;

      const analyzed = yield* journey({
        args: ["analyze", "--json"],
        cwd: repo.root,
      });
      const inspected = yield* journey({
        args: ["inspect", "src/users/handler.ts", "--json"],
        cwd: repo.root,
      });

      const report = yield* Schema.decodeUnknownEffect(Report)(
        JSON.parse(analyzed.stdout),
      );
      const result = yield* Schema.decodeUnknownEffect(InspectResult)(
        JSON.parse(inspected.stdout),
      );
      expect(report.copyFamilies).toStrictEqual([
        {
          files: [
            "lib/billing/handler.ts",
            "src/orders/handler.ts",
            "src/users/handler.ts",
          ],
          similarity: { min: 0.697, max: 0.697 },
          sharedChanges: 4,
          changesToAll: 4,
          testOnly: false,
        },
      ]);
      expect(result.matches[0]?.copyFamily).toStrictEqual(
        report.copyFamilies[0],
      );
    }).pipe(Effect.scoped),
  );
});
