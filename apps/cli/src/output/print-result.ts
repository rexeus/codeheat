// Owns the choice between the two output modes; commands only say what to print.
import { Console, Effect } from "effect";
import type { Stdio } from "effect";

import { renderJson } from "./json.js";
import { makeStyle, shouldUseColor } from "./terminal/style.js";
import type { Style } from "./terminal/style.js";

/**
 * Writes `value` to stdout: as one JSON document when `json` is set,
 * otherwise as `render`'s terminal text, styled only where color is allowed.
 */
export const printResult = <A>(
  value: A,
  json: boolean,
  render: (value: A, style: Style) => string,
): Effect.Effect<void, never, Stdio.Stdio> =>
  json
    ? Console.log(renderJson(value))
    : shouldUseColor.pipe(
        Effect.flatMap((color) => Console.log(render(value, makeStyle(color)))),
      );
