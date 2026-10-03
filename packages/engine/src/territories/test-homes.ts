// Owns where test code goes whose home is a directory: the code it belongs to
// may lie in several territories once its folder is split, and test code then
// has a `tests` child of the territory that holds them all, so that its heat
// does not inflate one sibling.
import { isTestPath } from "../modules/test-path.js";
import type { Part, TreeNode } from "./part.js";

const directoriesOf = (file: string): ReadonlyArray<string> => {
  const parts = file.split("/").slice(0, -1);
  return Array.from({ length: parts.length + 1 }, (_, length) =>
    parts.slice(0, length).join("/"),
  );
};

/** Every childless node, with the chain of nodes from the root down to it. */
const leafChains = (root: TreeNode): ReadonlyArray<ReadonlyArray<TreeNode>> => {
  const chains: Array<ReadonlyArray<TreeNode>> = [];
  const visit = (chain: ReadonlyArray<TreeNode>): void => {
    const node = chain.at(-1);
    if (node === undefined) {
      return;
    }
    if (node.children.length === 0) {
      chains.push(chain);
    }
    for (const child of node.children) {
      visit([...chain, child]);
    }
  };
  visit([root]);
  return chains;
};

/** Those of `directories` that have any of the code `files` below them. */
const reached = (
  files: ReadonlyArray<string>,
  directories: ReadonlySet<string>,
): ReadonlySet<string> =>
  new Set(
    files
      .filter((file) => !isTestPath(file))
      .flatMap((file) => directoriesOf(file))
      .filter((directory) => directories.has(directory)),
  );

/** The chains of the leaves that hold code below each of `directories`. */
const chainsBelow = (
  root: TreeNode,
  directories: ReadonlySet<string>,
): ReadonlyMap<string, ReadonlySet<ReadonlyArray<TreeNode>>> => {
  const below = new Map<string, Set<ReadonlyArray<TreeNode>>>();
  for (const chain of leafChains(root)) {
    for (const directory of reached(
      chain.at(-1)?.part.files ?? [],
      directories,
    )) {
      const set = below.get(directory) ?? new Set();
      set.add(chain);
      below.set(directory, set);
    }
  }
  return below;
};

/** The deepest node that every chain passes through. */
const commonNode = (
  chains: ReadonlyArray<ReadonlyArray<TreeNode>>,
): TreeNode | undefined => {
  const [first = []] = chains;
  const shared = first.filter((node, depth) =>
    chains.every((chain) => chain[depth] === node),
  );
  return shared.at(-1);
};

/** The longest directory that all of `files` are below; "" when there is none. */
const commonDirectory = (files: ReadonlyArray<string>): string => {
  const [first = ""] = files;
  const shared = directoriesOf(first).filter((directory) =>
    files.every((file) => directory === "" || file.startsWith(`${directory}/`)),
  );
  return shared.at(-1) ?? "";
};

const testsPart = (files: ReadonlyArray<string>): Part => ({
  kind: "tests",
  path: commonDirectory(files),
  files,
  members: [],
  base: "",
  rest: [],
});

/**
 * Adds, under each node that holds all the code some test code belongs to
 * (`placedIn`: test file to the directory whose code it belongs to) when that
 * code lies in several leaves, a `tests` child holding those tests. Test code
 * whose code lies in one leaf, or in none, is left to the caller.
 */
export const withTestHomes = (
  root: TreeNode,
  placedIn: ReadonlyMap<string, string>,
): TreeNode => {
  const below = chainsBelow(root, new Set(placedIn.values()));
  const homes = new Map(
    [...below].map(([directory, chains]) => [
      directory,
      chains.size > 1 ? commonNode([...chains]) : undefined,
    ]),
  );
  const extra = new Map<TreeNode, Array<string>>();
  for (const [test, directory] of placedIn) {
    const home = homes.get(directory);
    if (home !== undefined) {
      const tests = extra.get(home) ?? [];
      tests.push(test);
      extra.set(home, tests);
    }
  }
  if (extra.size === 0) {
    return root;
  }
  const rebuild = (node: TreeNode): TreeNode => {
    const tests = extra.get(node);
    return {
      ...node,
      children: [
        ...node.children.map((child) => rebuild(child)),
        ...(tests === undefined
          ? []
          : [{ part: testsPart(tests), reason: undefined, children: [] }]),
      ],
    };
  };
  return rebuild(root);
};
