// Owns finding copy families: among files that already change together, those whose content is largely the same.
import { Effect, FileSystem, Path } from "effect";

import type { History } from "../history/history.js";
import type { Coupling } from "../model/analysis.js";
import type { CopyFamily } from "../model/copy-family.js";
import { familiesOf } from "./families.js";
import { jaccard, shinglesOf } from "./similarity.js";
import { tokenize } from "./tokenize.js";

/** Smallest Jaccard index over shingles at which two coupled files are copies of each other. */
export const MIN_COPY_SIMILARITY = 0.5;
/** Files with fewer distinct shingles are too small for any similarity to mean something. */
const MIN_SHINGLES = 20;
/** Files read at once; bounds open file handles. */
const READ_CONCURRENCY = 16;

/** The shingles of `<root>/<file>`, or undefined when it cannot be read or is too small. */
const readShingles = (root: string, file: string) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const text = yield* fs.readFileString(path.join(root, file));
    const shingles = shinglesOf(tokenize(text));
    return shingles.size >= MIN_SHINGLES ? shingles : undefined;
  }).pipe(Effect.orElseSucceed(() => undefined));

/**
 * The copy families of a window: groups of files joined by couplings whose
 * contents are at least `MIN_COPY_SIMILARITY` alike, read from the work tree
 * under `root`. Only coupled files are compared to find families (never all
 * pairs of files), though a family's similarity range covers all pairs of its
 * members; a coupling between a file and its own test never counts. A file that cannot
 * be read, or is too small, is no member.
 */
export const findCopyFamilies = (
  root: string,
  couplings: ReadonlyArray<Coupling>,
  history: History,
): Effect.Effect<
  ReadonlyArray<CopyFamily>,
  never,
  FileSystem.FileSystem | Path.Path
> =>
  Effect.gen(function* () {
    const candidates = couplings.filter(({ testPair }) => !testPair);
    const files = [...new Set(candidates.flatMap(({ a, b }) => [a, b]))];
    const shingles = new Map(
      yield* Effect.forEach(
        files,
        (file) =>
          Effect.map(
            readShingles(root, file),
            (found) => [file, found] as const,
          ),
        { concurrency: READ_CONCURRENCY },
      ),
    );
    const similarityOf = (a: string, b: string): number => {
      const shinglesA = shingles.get(a);
      const shinglesB = shingles.get(b);
      return shinglesA === undefined || shinglesB === undefined
        ? 0
        : jaccard(shinglesA, shinglesB);
    };
    const links = candidates.filter(
      ({ a, b }): boolean => similarityOf(a, b) >= MIN_COPY_SIMILARITY,
    );
    return familiesOf(links, history, similarityOf);
  });
