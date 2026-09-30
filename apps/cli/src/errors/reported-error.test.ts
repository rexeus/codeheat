import { Runtime } from "effect";
import { CliError } from "effect/cli";
import { describe, expect, it } from "vitest";

import { NothingMatched } from "./nothing-matched.js";
import { toReportedError, toUnexpectedError } from "./reported-error.js";

describe("toReportedError", () => {
  it("maps unmatched inspect patterns to exit code 4", () => {
    const error = toReportedError(
      new NothingMatched({ patterns: ["a.ts", "src/*.md"] }),
    );

    expect(error.message).toBe('no file matches "a.ts", "src/*.md"');
    expect(error.exitCode).toBe(4);
  });
});

describe("toReportedError for parse failures and unsafe text", () => {
  it("maps a flag the parser rejected to a usage error", () => {
    const error = toReportedError(
      new CliError.UnrecognizedOption({
        option: "--nope",
        command: ["codeheat", "analyze"],
        suggestions: [],
      }),
    );

    expect(error.message).toBe(
      "Unrecognized flag: --nope in command codeheat analyze",
    );
    expect(error.exitCode).toBe(2);
  });

  it("joins the parse errors that came with a help display into one usage error", () => {
    const error = toReportedError(
      new CliError.ShowHelp({
        commandPath: ["codeheat"],
        errors: [
          new CliError.MissingOption({ option: "a" }),
          new CliError.MissingOption({ option: "b" }),
        ],
      }),
    );

    expect(error.message).toBe(
      "Missing required flag: --a; Missing required flag: --b",
    );
    expect(error.exitCode).toBe(2);
  });

  it("escapes control characters that came from user input", () => {
    const error = toReportedError(
      new NothingMatched({ patterns: ["\u001B[31mred\nline"] }),
    );

    expect(error.message).toBe('no file matches "\\u001b[31mred\\u000aline"');
  });

  it("tells the runtime the exit code and that the error is already reported", () => {
    const error = toReportedError(new NothingMatched({ patterns: ["a.ts"] }));

    expect(Runtime.getErrorExitCode(error)).toBe(4);
    expect(Runtime.getErrorReported(error)).toBe(false);
  });
});

describe("toUnexpectedError", () => {
  it("words a defect as exit code 1 without its stack", () => {
    const error = toUnexpectedError(new Error("boom"));

    expect(error.message).toBe("unexpected error: boom");
    expect(error.exitCode).toBe(1);
  });

  it("words a non-error defect with its string form", () => {
    expect(toUnexpectedError("broken").message).toBe(
      "unexpected error: broken",
    );
  });
});
