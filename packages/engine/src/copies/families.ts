// Owns grouping similar, coupled files into families and counting how often each family changed together.
import { Order } from "effect";

import { countedCommits } from "../coupling/coupling.js";
import type { History } from "../history/history.js";
import type { CopyFamily } from "../report/copy-family.js";
import { roundReported } from "../report/precision.js";

/** Two coupled files whose content is alike enough to be copies. */
export type Link = { readonly a: string; readonly b: string };

/** The sorted members of each connected component of the graph that `links` draw over files. */
const componentsOf = (
  links: ReadonlyArray<Link>,
): ReadonlyArray<ReadonlyArray<string>> => {
  const parent = new Map<string, string>();
  const rootOf = (file: string): string => {
    let root = file;
    for (
      let next = parent.get(root);
      next !== undefined && next !== root;
      next = parent.get(root)
    ) {
      root = next;
    }
    return root;
  };
  for (const { a, b } of links) {
    parent.set(rootOf(a), rootOf(b));
  }
  const components = new Map<string, Set<string>>();
  for (const { a, b } of links) {
    const root = rootOf(a);
    components.set(root, (components.get(root) ?? new Set()).add(a).add(b));
  }
  return [...components.values()].map((members) =>
    [...members].toSorted(Order.String),
  );
};

/** The weakest and the strongest similarity over every pair of `files`, not only the linked ones: a change to the family reaches all of them. */
const similarityRange = (
  files: ReadonlyArray<string>,
  similarityOf: (a: string, b: string) => number,
): { readonly min: number; readonly max: number } => {
  let min = 1;
  let max = 0;
  for (const [index, a] of files.entries()) {
    for (const b of files.slice(index + 1)) {
      const similarity = similarityOf(a, b);
      min = Math.min(min, similarity);
      max = Math.max(max, similarity);
    }
  }
  return { min: roundReported(min), max: roundReported(max) };
};

/** How many members of each family a commit touched, for the families it touched at all. */
const membersTouched = (
  files: Uint32Array,
  familyOfId: ReadonlyArray<number | undefined>,
): ReadonlyMap<number, number> => {
  const touched = new Map<number, number>();
  for (const id of files) {
    const family = familyOfId[id];
    if (family !== undefined) {
      touched.set(family, (touched.get(family) ?? 0) + 1);
    }
  }
  return touched;
};

/** How many counted commits touched at least two members, and how many touched all of them, per family. */
const countChanges = (
  families: ReadonlyArray<ReadonlyArray<string>>,
  history: History,
): ReadonlyArray<{ readonly shared: number; readonly all: number }> => {
  const familyOfPath = new Map(
    families.flatMap((members, index) =>
      members.map((member) => [member, index] as const),
    ),
  );
  const familyOfId = history.paths.map((path) => familyOfPath.get(path));
  const counts = families.map(() => ({ shared: 0, all: 0 }));
  for (const commit of countedCommits(history.commits)) {
    for (const [family, touched] of membersTouched(commit.files, familyOfId)) {
      const count = counts[family];
      if (count !== undefined && touched >= 2) {
        count.shared += 1;
        count.all += touched === families[family]?.length ? 1 : 0;
      }
    }
  }
  return counts;
};

const byImportance = (a: CopyFamily, b: CopyFamily): number =>
  b.changesToAll - a.changesToAll ||
  b.sharedChanges - a.sharedChanges ||
  b.files.length - a.files.length ||
  Order.String(a.files[0] ?? "", b.files[0] ?? "");

/**
 * The copy families among `links`: the connected components of the files
 * they join, most fixes applied to all members first, then most shared
 * changes, most members, and path. A family's `similarity` range covers all
 * pairs of its members, so its minimum can lie below the threshold that
 * linked them (A is like B, B like C, A not like C). `history` is the window
 * whose counted commits (see `countedCommits`) tell how often the members
 * changed together.
 */
export const familiesOf = (
  links: ReadonlyArray<Link>,
  history: History,
  similarityOf: (a: string, b: string) => number,
): ReadonlyArray<CopyFamily> => {
  const members = componentsOf(links);
  const changes = countChanges(members, history);
  return members
    .map((files, index) => ({
      files,
      similarity: similarityRange(files, similarityOf),
      sharedChanges: changes[index]?.shared ?? 0,
      changesToAll: changes[index]?.all ?? 0,
    }))
    .toSorted(byImportance);
};
