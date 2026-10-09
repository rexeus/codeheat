// Owns which territory each file ends up in once the tree is grown: the
// finest one that holds it.
import type { FlatNode } from "./flatten-tree.js";

/** The index of the childless node that holds each file the tree was grown over. */
export const fileLeaves = (
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
