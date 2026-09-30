// Owns reading a candidate file and deciding whether it is analyzable text.
import { Effect, FileSystem, Path } from "effect";
import type { ByteSize } from "effect";

import { measureComplexity } from "../metrics/complexity.js";
import type { Complexity } from "../metrics/complexity.js";

/** Larger files count as binary. */
export const MAX_FILE_BYTES = 1_048_576;
/** Text with longer lines on average counts as minified. */
export const MAX_MEAN_LINE_LENGTH = 300;
const BINARY_SNIFF_BYTES = 8192;

const isBinary = (bytes: Uint8Array): boolean =>
  bytes.subarray(0, BINARY_SNIFF_BYTES).includes(0);

const exceedsLimit = (size: ByteSize.ByteSize): boolean =>
  size > BigInt(MAX_FILE_BYTES);

/**
 * The complexity of `<root>/<file>`, or undefined when the file cannot be
 * analyzed: unreadable (missing, a directory, a submodule), binary, or minified.
 */
export const measureSourceFile = (
  root: string,
  file: string,
): Effect.Effect<
  Complexity | undefined,
  never,
  FileSystem.FileSystem | Path.Path
> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const location = path.join(root, file);
    const { size } = yield* fs.stat(location);
    if (exceedsLimit(size)) {
      return undefined;
    }
    const bytes = yield* fs.readFile(location);
    if (isBinary(bytes)) {
      return undefined;
    }
    const text = new TextDecoder().decode(bytes);
    const complexity = measureComplexity(text);
    return text.length > MAX_MEAN_LINE_LENGTH * complexity.loc
      ? undefined
      : complexity;
  }).pipe(Effect.orElseSucceed(() => undefined));
