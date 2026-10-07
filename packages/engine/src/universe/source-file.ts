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
 * What reading a candidate file found. `text`: analyzable, with its
 * complexity. `generated`: content that is no hand-written source: binary,
 * larger than `MAX_FILE_BYTES`, or minified. `unreadable`: missing, not a
 * regular file (a directory, a device), or nothing but whitespace.
 */
export type SourceReading =
  | { readonly kind: "text"; readonly complexity: Complexity }
  | { readonly kind: "generated" }
  | { readonly kind: "unreadable" };

const GENERATED: SourceReading = { kind: "generated" };
const UNREADABLE: SourceReading = { kind: "unreadable" };

/** Reads `<root>/<file>` and says whether it is analyzable text (see `SourceReading`). */
export const readSourceFile = (
  root: string,
  file: string,
): Effect.Effect<SourceReading, never, FileSystem.FileSystem | Path.Path> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const location = path.join(root, file);
    const info = yield* fs.stat(location);
    if (info.type !== "File") {
      return UNREADABLE;
    }
    if (exceedsLimit(info.size)) {
      return GENERATED;
    }
    const bytes = yield* fs.readFile(location);
    if (isBinary(bytes)) {
      return GENERATED;
    }
    const text = new TextDecoder().decode(bytes);
    const complexity = measureComplexity(text);
    if (text.length <= MAX_MEAN_LINE_LENGTH * complexity.loc) {
      return { kind: "text", complexity } satisfies SourceReading;
    }
    return complexity.loc === 0 ? UNREADABLE : GENERATED;
  }).pipe(Effect.orElseSucceed(() => UNREADABLE));
