import type { Analysis } from "@codeheat/engine";

type Territories = Analysis["territories"];

/** One area of the code, a node of the report's territory tree. */
export type Territory = Territories["nodes"][number];

/** The territories at the detail to read first, and how to find any territory from them. */
export type TerritoryIndex = {
  /** The territories at `Territories.recommended`, in the report's order (hottest real territory first). Empty without territories. */
  readonly recommended: readonly Territory[];
  readonly byId: ReadonlyMap<string, Territory>;
  /**
   * The territory at the recommended detail that holds `id`: `id` itself, or
   * the nearest ancestor that is visible there. `undefined` for an unknown id.
   */
  readonly visibleOf: (id: string) => Territory | undefined;
};

export const indexTerritories = ({
  recommended,
  details,
  nodes,
}: Territories): TerritoryIndex => {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const ids = details.find(({ level }) => level === recommended)?.ids ?? [];
  const visible = new Map(
    ids.flatMap((id) => {
      const node = byId.get(id);
      return node === undefined ? [] : [[id, node] as const];
    }),
  );
  const visibleOf = (id: string): Territory | undefined => {
    let current = byId.get(id);
    while (current !== undefined && !visible.has(current.id)) {
      current = current.parent === null ? undefined : byId.get(current.parent);
    }
    return current;
  };
  return { recommended: [...visible.values()], byId, visibleOf };
};

/** A territory that is a real part of the design, not a bucket of leftovers or test code. */
export const isRealTerritory = ({ kind }: Territory): boolean =>
  kind === "package" || kind === "folder" || kind === "group";

/** What an answer says when the recommended detail holds no real territory. */
export const NO_REAL_TERRITORY =
  "No real territory: only test code or leftover files changed.";

/** The text before the first `; main files:` of a description, which says what a bucket is. */
const bucketName = (description: string): string => {
  const cut = description.indexOf(";");
  return cut === -1 ? description : description.slice(0, cut);
};

/** A name split into the folder it shares and the part that tells it apart. */
export type NameParts = { readonly dir: string; readonly base: string };

const parentOf = (path: string): string =>
  path.slice(0, path.lastIndexOf("/") + 1);

const splitParts = (path: string): NameParts => {
  const dir = parentOf(path);
  return { dir, base: path.slice(dir.length) };
};

/** Whether the character at `index` follows an odd number of backslashes, which escape it. */
const isEscaped = (path: string, index: number): boolean => {
  let backslashes = 0;
  while (path[index - backslashes - 1] === "\\") {
    backslashes += 1;
  }
  return backslashes % 2 === 1;
};

/** Where the brace that balances the final `}` of `path` opens, scanning from the end; -1 when the name does not end in a brace glob. */
const openingBrace = (path: string): number => {
  let depth = 0;
  for (let index = path.length - 1; index >= 0; index -= 1) {
    const char = path[index];
    if ((char === "{" || char === "}") && !isEscaped(path, index)) {
      depth += char === "}" ? 1 : -1;
      if (depth === 0) {
        return index;
      }
    }
    if (depth === 0) {
      return -1;
    }
  }
  return -1;
};

/**
 * A group is one brace glob over the folder its members share, which is
 * named once: `packages/a/{x,y}` is `{x,y}` in `packages/a/`. The glob is the
 * braces that close the name, so a shared folder may hold braces of its own.
 */
const groupParts = (path: string): NameParts => {
  const open = openingBrace(path);
  return open === -1
    ? splitParts(path)
    : { dir: path.slice(0, open), base: path.slice(open) };
};

const PARTS: Record<Territory["kind"], (territory: Territory) => NameParts> = {
  package: ({ path }) => splitParts(path),
  folder: ({ path }) => splitParts(path),
  group: ({ path }) => groupParts(path),
  tests: ({ path }) => ({ dir: "", base: `tests in ${path}` }),
  other: ({ description }) => ({ dir: "", base: bucketName(description) }),
};

/** The name of a territory split for display: its folder, dimmed, and what tells it apart. */
export const territoryNameParts = (territory: Territory): NameParts =>
  PARTS[territory.kind](territory);

/** What to call a territory: its path (a group names its shared folder once), or for leftovers and test code, what they are. */
export const territoryName = (territory: Territory): string => {
  const { dir, base } = territoryNameParts(territory);
  return `${dir}${base}`;
};
