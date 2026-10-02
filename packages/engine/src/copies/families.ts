// Owns grouping similar, coupled files into families and counting how often each family changed together.
import { Order } from "effect";

import { countedCommits } from "../coupling/coupling.js";
import type { History } from "../history/history.js";
import type { CopyFamily } from "../report/copy-family.js";
import { roundReported } from "../report/precision.js";

/** Two coupled files and how alike their content is. */
export type SimilarPair = {
  readonly a: string;
  readonly b: string;
  readonly similarity: number;
};

/** The pairs of each connected component of the graph that `pairs` draw over files. */
const componentsOf = (
  pairs: ReadonlyArray<SimilarPair>,
): ReadonlyArray<ReadonlyArray<SimilarPair>> => {
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
  for (const { a, b } of pairs) {
    parent.set(rootOf(a), rootOf(b));
  }
  const components = new Map<string, Array<SimilarPair>>();
  for (const pair of pairs) {
    const root = rootOf(pair.a);
    const component = components.get(root) ?? [];
    component.push(pair);
    components.set(root, component);
  }
  return [...components.values()];
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
 * The copy families among `pairs`: the connected components of the files
 * they join, most fixes applied to all members first, then most shared
 * changes, most members, and path. `history` is the window whose counted
 * commits (see `countedCommits`) tell how often the members changed together.
 */
export const familiesOf = (
  pairs: ReadonlyArray<SimilarPair>,
  history: History,
): ReadonlyArray<CopyFamily> => {
  const components = componentsOf(pairs);
  const members = components.map((component) =>
    [...new Set(component.flatMap(({ a, b }) => [a, b]))].toSorted(
      Order.String,
    ),
  );
  const changes = countChanges(members, history);
  return components
    .map((component, index) => {
      const similarities = component.map(({ similarity }) => similarity);
      return {
        files: members[index] ?? [],
        similarity: {
          min: roundReported(similarities.reduce((a, b) => Math.min(a, b))),
          max: roundReported(similarities.reduce((a, b) => Math.max(a, b))),
        },
        sharedChanges: changes[index]?.shared ?? 0,
        changesToAll: changes[index]?.all ?? 0,
      };
    })
    .toSorted(byImportance);
};
