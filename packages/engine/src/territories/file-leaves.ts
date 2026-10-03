// Owns which territory each file ends up in once the tree is grown: the
// finest one that holds it, with test code following the code it tests.
import { isTestPath } from "../modules/test-path.js";
import type { TestAttachment } from "./attach-tests.js";
import type { FlatNode } from "./flatten-tree.js";

/** The index of the childless node that holds each file the tree was grown over. */
const unitLeaves = (
  nodes: ReadonlyArray<FlatNode>,
): ReadonlyMap<string, number> => {
  const leaves = new Map<string, number>();
  for (const [index, { node }] of nodes.entries()) {
    if (node.children.length === 0) {
      for (const file of node.part.files) {
        leaves.set(file, index);
      }
    }
  }
  return leaves;
};

/** Per directory, how many code files each leaf holds below it; the root is "". */
const leavesBelow = (
  leaves: ReadonlyMap<string, number>,
): ReadonlyMap<string, ReadonlyMap<number, number>> => {
  const below = new Map<string, Map<number, number>>();
  for (const [file, leaf] of leaves) {
    if (!isTestPath(file)) {
      const parts = file.split("/").slice(0, -1);
      for (let length = 0; length <= parts.length; length += 1) {
        const directory = parts.slice(0, length).join("/");
        const counts = below.get(directory) ?? new Map<number, number>();
        counts.set(leaf, (counts.get(leaf) ?? 0) + 1);
        below.set(directory, counts);
      }
    }
  }
  return below;
};

/** The leaf with the most code files below `directory`; the earliest wins a tie. */
const majorityLeaf = (
  counts: ReadonlyMap<number, number> | undefined,
): number | undefined =>
  [...(counts ?? [])].toSorted(([a, x], [b, y]) => y - x || a - b)[0]?.[0];

/**
 * The index of the node each file belongs to (the finest). Code files and
 * unattached tests are where the tree put them; a test that pairs with code is
 * where that code is; a test placed in a directory is in the leaf that holds
 * most of the directory's code.
 */
export const fileLeaves = (
  nodes: ReadonlyArray<FlatNode>,
  attachment: TestAttachment,
): ReadonlyMap<string, number> => {
  const units = unitLeaves(nodes);
  const leaves = new Map(units);
  for (const [test, source] of attachment.pairedWith) {
    const leaf = leaves.get(source);
    if (leaf !== undefined) {
      leaves.set(test, leaf);
    }
  }
  const below = attachment.placedIn.size === 0 ? undefined : leavesBelow(units);
  for (const [test, directory] of attachment.placedIn) {
    const leaf = majorityLeaf(below?.get(directory));
    if (leaf !== undefined) {
      leaves.set(test, leaf);
    }
  }
  return leaves;
};
