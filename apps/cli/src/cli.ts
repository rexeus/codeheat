import { Cause, Console, Effect, Exit } from "effect";
import { CliError, Command } from "effect/cli";

import { analyzeCommand } from "./commands/analyze.js";
import { inspectCommand } from "./commands/inspect.js";
import {
  CliReportedError,
  toReportedError,
  toUnexpectedError,
} from "./errors/reported-error.js";
import { version } from "./version.js";

const root = Command.make("codeheat").pipe(
  Command.withDescription(
    "Find hotspots and change coupling in a git repository.",
  ),
  Command.withSubcommands([analyzeCommand, inspectCommand]),
);

const isHelpRequest = (error: unknown): boolean =>
  CliError.isCliError(error) &&
  error._tag === "ShowHelp" &&
  error.errors.length === 0;

const run = Command.runWith(root, { version, renderErrors: false });

const toReported = (args: ReadonlyArray<string>) =>
  run(args).pipe(
    Effect.catchIf(
      (error) => !isHelpRequest(error),
      (error) => Effect.fail(toReportedError(error)),
    ),
    Effect.catchDefect((defect) => Effect.fail(toUnexpectedError(defect))),
  );

/**
 * Runs codeheat against the given arguments (without the node and script path).
 *
 * Every failure ends as a `CliReportedError` whose exit code the process
 * adopts, and as a single `codeheat: <message>` line on stderr. Only a help
 * request passes through unchanged, and it exits 0.
 *
 * Stdout stays clean on failure: the framework prints usage help through
 * `Console.log` before it fails, so the run's `Console.log` lines are held
 * back and go to stderr when the run failed, to stdout when it did not.
 */
export const runCli = (args: ReadonlyArray<string>) =>
  Effect.gen(function* () {
    const real = yield* Console.Console;
    const held: Array<string> = [];
    const holding: Console.Console = Object.assign({}, real, {
      log: (...values: ReadonlyArray<unknown>) => {
        held.push(values.map(String).join(" "));
      },
    });
    const exit = yield* toReported(args).pipe(
      Effect.provideService(Console.Console, holding),
      Effect.exit,
    );
    const failure = Exit.isFailure(exit) ? Cause.squash(exit.cause) : undefined;
    const reported = failure instanceof CliReportedError ? failure : undefined;
    yield* Effect.sync(() => {
      for (const line of held) {
        if (reported === undefined) {
          real.log(line);
        } else {
          real.error(line);
        }
      }
      if (reported !== undefined) {
        real.error(`codeheat: ${reported.message}`);
      }
    });
    return yield* exit;
  });
