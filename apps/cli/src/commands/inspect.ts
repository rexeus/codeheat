import { analyze, inspect } from "@codeheat/engine";
import { Console, Effect } from "effect";
import { Argument, Command } from "effect/cli";

import { NothingMatched } from "../errors/nothing-matched.js";
import { escapeForTerminal } from "../output/escape.js";
import { printResult } from "../output/print-result.js";
import { warnIfShallow } from "../output/shallow-warning.js";
import { renderInspect } from "../output/terminal/inspect-view.js";
import { version } from "../version.js";
import { WorkingDirectory } from "../working-directory.js";
import { jsonFlag, sinceFlag } from "./shared-flags.js";

export const inspectCommand = Command.make(
  "inspect",
  {
    patterns: Argument.String("file-or-glob").pipe(
      Argument.withDescription(
        "Repository-relative path or glob, quoted so the shell leaves it alone",
      ),
      Argument.variadic({ min: 1 }),
    ),
    json: jsonFlag,
    since: sinceFlag,
  },
  Effect.fn(function* ({ patterns, json, since }) {
    const report = yield* analyze({
      cwd: yield* WorkingDirectory,
      since,
      include: [],
      exclude: [],
      toolVersion: version,
    });
    yield* warnIfShallow(report);
    const result = inspect(report, patterns);
    if (result.matches.length === 0) {
      return yield* new NothingMatched({ patterns: result.unmatched });
    }
    for (const pattern of result.unmatched) {
      yield* Console.error(
        `codeheat: no file matches "${escapeForTerminal(pattern)}"`,
      );
    }
    return yield* printResult(result, json, renderInspect);
  }),
).pipe(
  Command.withDescription(
    "Show rank, metrics and change-coupling partners of files before editing them.",
  ),
  Command.withExamples([
    {
      command: "codeheat inspect src/billing/invoice.ts",
      description: "What to know before editing one file",
    },
    {
      command: 'codeheat inspect "packages/*/src/index.ts" --json',
      description:
        "How often the public barrels change, and what changes with them",
    },
  ]),
);
