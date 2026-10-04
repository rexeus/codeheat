// Owns walking up the territory tree from a file's territory.
import type { Territory } from "../report/territory.js";

/**
 * For each territory id, the ids of its ancestors and itself, the root
 * included; an unknown id is only itself. Each chain is built once.
 */
export const chainsOf = (
  nodes: ReadonlyArray<Pick<Territory, "id" | "parent">>,
): ((id: string) => ReadonlySet<string>) => {
  const parents = new Map(nodes.map(({ id, parent }) => [id, parent]));
  const known = new Map<string, ReadonlySet<string>>();
  return (id) => {
    const cached = known.get(id);
    if (cached !== undefined) {
      return cached;
    }
    const chain = new Set<string>();
    for (
      let at: string | null | undefined = id;
      at !== null && at !== undefined && !chain.has(at);
      at = parents.get(at)
    ) {
      chain.add(at);
    }
    known.set(id, chain);
    return chain;
  };
};
