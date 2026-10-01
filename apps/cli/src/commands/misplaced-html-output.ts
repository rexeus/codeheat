// Owns spotting `--html report.html`, where the file name landed in the path argument.
import { Effect, Option } from "effect";

import { MisplacedHtmlOutput } from "../errors/misplaced-html-output.js";

const HTML_FILE = /\.html$/iu;

/**
 * Fails with `MisplacedHtmlOutput` when `--html` is given without `--out` and
 * the path argument ends in `.html`, whether or not anything of that name
 * exists: `--html` takes no value, so such a path is almost always the file
 * `--out` should name. The check is textual and runs before any analysis. A
 * trailing separator (`./x.html/`) does not end in `.html` and so still
 * analyzes a directory of that name.
 */
export const rejectMisplacedHtmlOutput = (options: {
  readonly path: Option.Option<string>;
  readonly html: boolean;
  readonly out: Option.Option<string>;
}): Effect.Effect<void, MisplacedHtmlOutput> =>
  Option.isSome(options.path) &&
  options.html &&
  Option.isNone(options.out) &&
  HTML_FILE.test(options.path.value)
    ? Effect.fail(new MisplacedHtmlOutput({ path: options.path.value }))
    : Effect.void;
