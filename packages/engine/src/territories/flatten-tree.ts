// Owns turning the grown tree into the flat list of nodes the report holds,
// and what each node is called.
import type { Territory } from "../model/territory.js";
import type { TreeNode } from "./part.js";

/** A node of the tree with its place in the flat list. */
export type FlatNode = {
  readonly node: TreeNode;
  /** The id the report gives it: `t1`, `t2`, … in tree order. */
  readonly id: string;
  /** Index of its parent in the list; null for the root. */
  readonly parent: number | null;
  readonly kind: Territory["kind"];
};

const kindOf = (
  { part }: TreeNode,
  packages: ReadonlySet<string>,
): Territory["kind"] => {
  if (part.kind === "folder") {
    return packages.has(part.path) ? "package" : "folder";
  }
  return part.kind === "more" ? "other" : part.kind;
};

/** The nodes of the tree, each before its children, the root first. */
export const flatten = (
  root: TreeNode,
  packages: ReadonlySet<string>,
): ReadonlyArray<FlatNode> => {
  const nodes: Array<FlatNode> = [];
  const visit = (node: TreeNode, parent: number | null): void => {
    const index = nodes.length;
    nodes.push({
      node,
      id: `t${index + 1}`,
      parent,
      kind: kindOf(node, packages),
    });
    for (const child of node.children) {
      visit(child, index);
    }
  };
  visit(root, null);
  return nodes;
};
