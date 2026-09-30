// Owns how a failure ends the process: one terminal-safe line and an exit code.
import type { AnalyzeError } from "@codeheat/engine";
import { Runtime, Schema } from "effect";
import { CliError } from "effect/cli";

import { escapeForTerminal } from "../output/escape.js";
import type { NothingMatched } from "./nothing-matched.js";

const UNEXPECTED = 1;
const USAGE = 2;
const NOT_A_REPOSITORY = 3;
const NOTHING_MATCHED = 4;

/**
 * A failure that is already worded for the user. Its message is escaped and
 * `[Runtime.errorReported]` is false: the runtime must not print a second
 * report, and `[Runtime.errorExitCode]` becomes the process exit code.
 */
export class CliReportedError extends Schema.TaggedError<CliReportedError>()(
  "CliReportedError",
  {
    message: Schema.String,
    exitCode: Schema.Int,
  },
) {
  override readonly [Runtime.errorExitCode] = this.exitCode;
  override readonly [Runtime.errorReported] = false;
}

/** Every expected failure a command can end with, except a help request. */
export type KnownFailure = AnalyzeError | NothingMatched | CliError.CliError;

type Failure = { readonly message: string; readonly exitCode: number };

const cliFailure = (error: CliError.CliError): Failure => {
  if (error._tag === "ShowHelp") {
    return {
      message: error.errors.map((cause) => cause.message).join("; "),
      exitCode: USAGE,
    };
  }
  return {
    message: error.message,
    exitCode: error._tag === "UserError" ? UNEXPECTED : USAGE,
  };
};

const engineFailure = (error: AnalyzeError | NothingMatched): Failure => {
  if (error._tag === "InvalidSince") {
    return {
      message: `invalid --since "${error.input}": use <n>d, <n>w, <n>m, <n>y or YYYY-MM-DD`,
      exitCode: USAGE,
    };
  }
  if (error._tag === "NotAGitRepository") {
    return {
      message: `not a git repository: ${error.path}`,
      exitCode: NOT_A_REPOSITORY,
    };
  }
  if (error._tag === "GitNotFound") {
    return {
      message: "git was not found on PATH; codeheat needs git",
      exitCode: NOT_A_REPOSITORY,
    };
  }
  if (error._tag === "GitCommandFailed") {
    return {
      message: `git ${error.args.join(" ")} failed with exit code ${error.exitCode}: ${error.stderr.trim()}`,
      exitCode: UNEXPECTED,
    };
  }
  return {
    message: `no file matches ${error.patterns.map((pattern) => `"${pattern}"`).join(", ")}`,
    exitCode: NOTHING_MATCHED,
  };
};

const describe = (error: KnownFailure): Failure =>
  CliError.isCliError(error) ? cliFailure(error) : engineFailure(error);

const reported = ({ message, exitCode }: Failure): CliReportedError =>
  new CliReportedError({ message: escapeForTerminal(message), exitCode });

/**
 * Words an expected failure and assigns its exit code: 2 for usage errors
 * (including an invalid `--since`), 3 for no git repository or no git,
 * 4 when `inspect` matched nothing, 1 for the rest.
 */
export const toReportedError = (error: KnownFailure): CliReportedError =>
  reported(describe(error));

/** Words a defect, a bug rather than a condition the user can fix, as exit code 1. */
export const toUnexpectedError = (defect: unknown): CliReportedError =>
  reported({
    message: `unexpected error: ${defect instanceof Error ? defect.message : String(defect)}`,
    exitCode: UNEXPECTED,
  });
