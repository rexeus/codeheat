// Runs the real `runCli` in-process with captured output, as TESTING.md's CLI journeys do.
import { NodeServices } from "@effect/platform-node";
import { ConfigProvider, Console, Effect, Layer, Runtime, Stdio } from "effect";

import { runCli } from "../cli.js";
import { WorkingDirectory } from "../working-directory.js";

export type JourneyOptions = {
  /** The command line without the node and script path. */
  readonly args: ReadonlyArray<string>;
  /** The directory relative paths resolve against; defaults to the process directory. */
  readonly cwd?: string;
  /** The environment the run sees; defaults to empty so the host's never leaks in. */
  readonly env?: Record<string, string>;
  /** Whether standard output looks like a terminal; defaults to false. */
  readonly stdoutIsTerminal?: boolean;
};

export type JourneyResult = {
  /** Every `Console.log` line, newline-joined. */
  readonly stdout: string;
  /** Every `Console.error` line, newline-joined. */
  readonly stderr: string;
  /** The exit code the process would end with. */
  readonly exitCode: number;
};

/** Runs `runCli` against real platform services and reports what a shell would see. */
export const journey = (
  options: JourneyOptions,
): Effect.Effect<JourneyResult> =>
  Effect.gen(function* () {
    const stdout: Array<string> = [];
    const stderr: Array<string> = [];
    const captured: Console.Console = {
      ...globalThis.console,
      log: (...values) => {
        stdout.push(values.map(String).join(" "));
      },
      error: (...values) => {
        stderr.push(values.map(String).join(" "));
      },
    };
    const environment = Layer.mergeAll(
      NodeServices.layer,
      Stdio.layerTest({
        stdoutIsTerminal: Effect.succeed(options.stdoutIsTerminal ?? false),
      }),
      Layer.succeed(
        ConfigProvider.ConfigProvider,
        ConfigProvider.fromEnvRecord(options.env ?? {}),
      ),
    );
    const exit = yield* runCli(options.args).pipe(
      Effect.provideService(Console.Console, captured),
      Effect.provideService(WorkingDirectory, options.cwd ?? process.cwd()),
      Effect.provide(environment),
      Effect.exit,
    );
    let exitCode = 0;
    Runtime.defaultTeardown(exit, (code) => {
      exitCode = code;
    });
    return { stdout: stdout.join("\n"), stderr: stderr.join("\n"), exitCode };
  });
