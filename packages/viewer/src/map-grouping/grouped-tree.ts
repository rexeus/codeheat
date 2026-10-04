// Owns the treemap's tree when files are grouped by territory: a group per
// territory with the folder tree of its files inside.
import type { FileStats } from "@codeheat/engine";

import { buildTree } from "../layout/hierarchy.js";
import type { DirectoryNode, TreeNode } from "../layout/hierarchy.js";
import { groupName } from "./territory-groups.js";
import type { Group } from "./territory-groups.js";

/**
 * The children of `tree` below the chain of folders that only hold one folder
 * (`packages/core` above `src` and `test`): a territory is drawn under its own
 * name, so the path that leads to it is not repeated inside.
 */
const interiorOf = (tree: DirectoryNode): readonly TreeNode[] => {
  let node = tree;
  for (;;) {
    const [only] = node.children;
    if (node.children.length !== 1 || only?.kind !== "directory") {
      return node.children;
    }
    node = only;
  }
};

/** The group of a territory: its name over the folders and files it holds. */
const groupNode = (
  group: Group,
  keep: ReadonlySet<string>,
  population: readonly FileStats[],
): DirectoryNode => ({
  kind: "directory",
  name: groupName(group),
  path: `territory:${group.territory.id}`,
  children: interiorOf(buildTree(group.files, keep, population)),
});

/**
 * The tree of every file in `groups`, a group per territory. Small files merge
 * (see `buildTree`) as if all the groups' files were drawn together.
 */
export const buildGroupedTree = (
  groups: readonly Group[],
  keep: ReadonlySet<string>,
): DirectoryNode => {
  const population = groups.flatMap(({ files }) => files);
  return {
    kind: "directory",
    name: "",
    path: "",
    children: groups.map((group) => groupNode(group, keep, population)),
  };
};

/**
 * The tree of one territory alone, filling the map: its folders and files
 * without a group of its own. Small files merge as if only its files were drawn.
 */
export const buildZoomTree = (
  group: Group,
  keep: ReadonlySet<string>,
): DirectoryNode => ({
  kind: "directory",
  name: groupName(group),
  path: `territory:${group.territory.id}`,
  children: interiorOf(buildTree(group.files, keep)),
});
