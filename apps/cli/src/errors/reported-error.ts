// Owns how a failure ends the process: one terminal-safe line and an exit code.
import type { AnalyzeError } from "@codeheat/engine";
import { Runtime, Schema } from "effect";
import { CliError } from "effect/cli";

import { escapeForTerminal } from "../output/escape.js";
import type { HtmlWriteFailed } from "../output/html/html-write-failed.js";
import type { FlagsConflict } from "./flags-conflict.js";
import type { MisplacedHtmlOutput } from "./misplaced-html-output.js";
import type { NothingMatched } from "./nothing-matched.js";
import type { PathNotFound } from "./path-not-found.js";

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
export type KnownFailure =
  | AnalyzeError
  | FlagsConflict
  | MisplacedHtmlOutput
  | NothingMatched
  | PathNotFound
  | HtmlWriteFailed
  | CliError.CliError;

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

const shellWord = (text: string): string =>
  /[\s"'\\$`]/u.test(text) ? `"${text.replaceAll(/["\\$`]/gu, "\\$&")}"` : text;

const usageMessage = (
  error: Extract<
    KnownFailure,
    {
      _tag:
        | "InvalidSince"
        | "InvalidCompare"
        | "FlagsConflict"
        | "MisplacedHtmlOutput"
        | "PathNotFound";
    }
  >,
): string => {
  if (error._tag === "InvalidSince") {
    return `invalid --since "${error.input}": use <n>d, <n>w, <n>m, <n>y or YYYY-MM-DD`;
  }
  if (error._tag === "InvalidCompare") {
    return `invalid --compare "${error.input}": use <n>d, <n>w, <n>m or <n>y`;
  }
  if (error._tag === "FlagsConflict") {
    return `${error.flags.join(" and ")} cannot be combined`;
  }
  if (error._tag === "MisplacedHtmlOutput") {
    return `--html takes no file name; to write the treemap to ${error.path}, use --out ${shellWord(error.path)} (to analyze a directory of that name, write ${shellWord(`${error.path}/`)})`;
  }
  return `no such file or directory: ${error.path}`;
};

const engineFailure = (
  error:
    | AnalyzeError
    | FlagsConflict
    | MisplacedHtmlOutput
    | NothingMatched
    | PathNotFound
    | HtmlWriteFailed,
): Failure => {
  if (
    error._tag === "InvalidSince" ||
    error._tag === "InvalidCompare" ||
    error._tag === "FlagsConflict" ||
    error._tag === "MisplacedHtmlOutput" ||
    error._tag === "PathNotFound"
  ) {
    return { message: usageMessage(error), exitCode: USAGE };
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
  if (error._tag === "HtmlWriteFailed") {
    return {
      message: `cannot write ${error.path}: ${error.reason}`,
      exitCode: UNEXPECTED,
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
 * (an invalid `--since` or `--compare`, flags that cannot be combined, a path
 * that does not exist, a `.html` path given to `--html` instead of `--out`),
 * 3 for no git repository or no git, 4 when `inspect` matched nothing, 1 for
 * the rest.
 */
export const toReportedError = (error: KnownFailure): CliReportedError =>
  reported(describe(error));

/** Words a defect, a bug rather than a condition the user can fix, as exit code 1. */
export const toUnexpectedError = (defect: unknown): CliReportedError =>
  reported({
    message: `unexpected error: ${defect instanceof Error ? defect.message : String(defect)}`,
    exitCode: UNEXPECTED,
  });
