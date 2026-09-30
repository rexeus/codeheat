import { analyze } from "@codeheat/engine";
import { Effect, Path } from "effect";
import { Argument, Command, Flag } from "effect/cli";

import { limitReport } from "../output/limit-report.js";
import { printResult } from "../output/print-result.js";
import { renderAnalysis } from "../output/terminal/analysis-view.js";
import { version } from "../version.js";
import { WorkingDirectory } from "../working-directory.js";
import { jsonFlag, sinceFlag } from "./shared-flags.js";

const DEFAULT_LIMIT = 25;

export const analyzeCommand = Command.make(
  "analyze",
  {
    path: Argument.String("path").pipe(
      Argument.withDescription(
        "Directory inside the repository; only files under it are analyzed",
      ),
      Argument.withDefault("."),
    ),
    json: jsonFlag,
    since: sinceFlag,
    include: Flag.String("include").pipe(
      Flag.withDescription(
        "Glob of files to analyze instead of the language list; repeatable",
      ),
      Flag.atLeast(0),
    ),
    exclude: Flag.String("exclude").pipe(
      Flag.withDescription("Glob of files to leave out; repeatable"),
      Flag.atLeast(0),
    ),
    limit: Flag.Int("limit").pipe(
      Flag.withDescription(
        `Files and couplings to report, each; 0 for no limit (default ${DEFAULT_LIMIT})`,
      ),
      Flag.withDefault(DEFAULT_LIMIT),
      Flag.filter(
        (limit) => limit >= 0,
        (limit) => `--limit must be 0 or greater, got ${limit}`,
      ),
    ),
  },
  Effect.fn(function* ({ path, json, since, include, exclude, limit }) {
    const cwd = yield* WorkingDirectory;
    const paths = yield* Path.Path;
    const report = yield* analyze({
      path: paths.resolve(cwd, path),
      since,
      include,
      exclude,
      toolVersion: version,
    });
    const shown = limitReport(report, limit);
    return yield* printResult(shown, json, renderAnalysis);
  }),
).pipe(
  Command.withDescription(
    "Show the hotspots and change coupling of a git repository.",
  ),
  Command.withExamples([
    {
      command: "codeheat analyze",
      description: "Top hotspots and couplings of the current repository",
    },
    {
      command:
        'codeheat analyze packages/api --since 6m --exclude "**/*.generated.ts" --json',
      description: "One package over six months, as JSON for an agent",
    },
  ]),
);
