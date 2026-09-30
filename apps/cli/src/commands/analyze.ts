import { analyze } from "@codeheat/engine";
import { Effect, Option } from "effect";
import { Argument, Command, Flag } from "effect/cli";

import { writeHtmlReport } from "../output/html/write-html-report.js";
import { limitReport } from "../output/limit-report.js";
import { printResult } from "../output/print-result.js";
import { warnIfShallow } from "../output/shallow-warning.js";
import { renderAnalysis } from "../output/terminal/analysis-view.js";
import { version } from "../version.js";
import { WorkingDirectory } from "../working-directory.js";
import { resolveAnalysisTarget } from "./analysis-target.js";
import { jsonFlag, sinceFlag } from "./shared-flags.js";

const DEFAULT_LIMIT = 25;
const DEFAULT_HTML_FILE = "codeheat-report.html";

export const analyzeCommand = Command.make(
  "analyze",
  {
    path: Argument.String("path").pipe(
      Argument.withDescription(
        "Directory or file inside the repository; only files under it are analyzed (default: the whole repository)",
      ),
      Argument.optional,
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
    html: Flag.Boolean("html").pipe(
      Flag.withDescription(
        "Also write the treemap as a self-contained HTML file and open it",
      ),
      Flag.withDefault(false),
    ),
    out: Flag.String("out").pipe(
      Flag.withDescription(
        `Where --html writes the treemap (default ${DEFAULT_HTML_FILE}); implies --html`,
      ),
      Flag.optional,
    ),
    open: Flag.Boolean("open").pipe(
      Flag.withDescription(
        "Open the treemap in the browser; --no-open skips it",
      ),
      Flag.withDefault(true),
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
  Effect.fn(function* (flags) {
    const { path, json, since, include, exclude, limit } = flags;
    const cwd = yield* WorkingDirectory;
    // A path argument both locates the repository and narrows the universe,
    // so `codeheat analyze ../other-repo` works from anywhere.
    const target = yield* resolveAnalysisTarget(cwd, path);
    const report = yield* analyze({
      ...target,
      since,
      include,
      exclude,
      toolVersion: version,
    });
    yield* warnIfShallow(report);
    if (flags.html || Option.isSome(flags.out)) {
      yield* writeHtmlReport({
        report,
        file: Option.getOrElse(flags.out, () => DEFAULT_HTML_FILE),
        cwd,
        open: flags.open,
      });
    }
    // --limit bounds the JSON document; the terminal view picks its own top entries.
    return yield* printResult(
      json ? limitReport(report, limit) : report,
      json,
      renderAnalysis,
    );
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
      command: "codeheat analyze --html",
      description: "Open the treemap of the current repository in the browser",
    },
    {
      command:
        'codeheat analyze packages/api --since 6m --exclude "**/*.generated.ts" --json',
      description: "One package over six months, as JSON for an agent",
    },
  ]),
);
