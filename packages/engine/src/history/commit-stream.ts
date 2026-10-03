// Owns turning one `git log` invocation into parsed commits.
import { Effect, Stream } from "effect";

import type { GitError } from "../git/git-errors.js";
import { Git } from "../git/git.js";
import { LogParser } from "./parse-log.js";
import type { Commit } from "./parse-log.js";

/** Arguments that make `git log` print what `LogParser` reads (see its header). */
const LOG_FORMAT_ARGS = [
  "--no-merges",
  "-M",
  "--raw",
  // Full object ids: an abbreviated one gains `...` under GIT_PRINT_SHA1_ELLIPSIS.
  "--no-abbrev",
  "--numstat",
  "-z",
  "--no-show-signature",
  "--format=%x01%H%x00%ct%x00%B",
] as const;

/**
 * The commits `git log <selection>` prints, in the order it prints them, in
 * the format `LogParser` reads. `selection` must not set the output format;
 * `stdin` is written to the process (for `--stdin`).
 */
export const streamCommits = (
  selection: ReadonlyArray<string>,
  stdin?: string,
): Stream.Stream<Commit, GitError, Git> =>
  Stream.unwrap(
    Effect.gen(function* () {
      const git = yield* Git;
      return git.stream(["log", ...LOG_FORMAT_ARGS, ...selection], stdin).pipe(
        Stream.mapAccum(
          () => new LogParser(),
          (parser, chunk) => [parser, parser.push(chunk)],
          { onHalt: (parser) => parser.end() },
        ),
      );
    }),
  );
