// Owns publishing the treemap: writing the HTML file and handing it to a browser.
import type { Analysis } from "@codeheat/engine";
import { renderReportHtml } from "@codeheat/viewer";
import { Console, Effect, FileSystem, Path } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/process";

import { escapeForTerminal } from "../escape.js";
import { HtmlWriteFailed } from "./html-write-failed.js";
import { openCommand } from "./open-command.js";

/**
 * Starts the platform's opener and lets it go: codeheat neither waits for it
 * (some launchers run the browser in the foreground) nor kills its process
 * group on exit, which an awaited, still-referenced child would get.
 */
const openInBrowser = (file: string) =>
  Effect.gen(function* () {
    const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
    const { command, args } = openCommand(process.platform, file);
    const handle = yield* spawner.spawn(
      ChildProcess.make(command, args, {
        stdin: "ignore",
        stdout: "ignore",
        stderr: "ignore",
      }),
    );
    // The returned re-ref effect is dropped: the opener stays unreferenced.
    yield* Effect.asVoid(handle.unref);
  }).pipe(
    Effect.scoped,
    // Headless machines have no browser; the printed path is the fallback.
    Effect.ignore,
  );

/**
 * Writes the self-contained treemap for `report` to `file` (resolved against
 * `cwd`), prints its absolute path to stderr so stdout stays free for
 * `--json`, and opens it unless `open` is false. Failing to open is not an
 * error.
 */
export const writeHtmlReport = (options: {
  readonly report: Analysis;
  readonly file: string;
  readonly cwd: string;
  readonly open: boolean;
}) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const paths = yield* Path.Path;
    const target = paths.resolve(options.cwd, options.file);
    yield* fs
      .writeFileString(target, renderReportHtml(options.report))
      .pipe(
        Effect.mapError(
          (error) =>
            new HtmlWriteFailed({ path: target, reason: error.message }),
        ),
      );
    yield* Console.error(`codeheat: wrote ${escapeForTerminal(target)}`);
    if (options.open) {
      yield* openInBrowser(target);
    }
  });
