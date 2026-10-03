// Owns counting how the changes touching a part spread over its folders: how
// many touched each folder, each pair, and just one.
import type { FolderCut } from "./folders.js";
import { pairKey } from "./keep-together.js";
import type { Evidence } from "./part.js";

/** The owner of files that belong to no folder of the cut. */
const REST = "\0rest";

/** The folder (or `REST`) each file of the cut belongs to. */
export const ownersOf = (cut: FolderCut): ReadonlyMap<string, string> =>
  new Map<string, string>([
    ...[...cut.big].flatMap(([key, files]) =>
      files.map((file): [string, string] => [file, key]),
    ),
    ...cut.rest.map((file): [string, string] => [file, REST]),
  ]);

const bump = (counts: Map<string, number>, key: string): void => {
  counts.set(key, (counts.get(key) ?? 0) + 1);
};

/** Counts one change that touched `owners` (sorted, distinct): each of them, and each pair of folders. */
const countOwners = (
  owners: ReadonlyArray<string>,
  per: Map<string, number>,
  pair: Map<string, number>,
): void => {
  for (const [at, x] of owners.entries()) {
    bump(per, x);
    for (const y of owners.slice(at + 1)) {
      if (x !== REST && y !== REST) {
        bump(pair, pairKey(x, y));
      }
    }
  }
};

/**
 * How many of the `touching` changes touched each part (loose files count as
 * one, `REST`), each pair of folders, and how many stayed inside one part.
 */
export const tallyParts = (
  touching: ReadonlySet<number>,
  owner: ReadonlyMap<string, string>,
  evidence: Evidence,
): {
  readonly per: ReadonlyMap<string, number>;
  readonly pair: ReadonlyMap<string, number>;
  readonly single: number;
} => {
  const per = new Map<string, number>();
  const pair = new Map<string, number>();
  let single = 0;
  for (const index of touching) {
    const owners = [
      ...new Set(
        (evidence.changes[index] ?? []).flatMap(
          (file) => owner.get(file) ?? [],
        ),
      ),
    ].toSorted();
    single += owners.length === 1 ? 1 : 0;
    countOwners(owners, per, pair);
  }
  return { per, pair, single };
};
