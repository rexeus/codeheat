import type { Report } from "@codeheat/engine";

type Territories = Report["territories"];

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

/** The text before the first `; main files:` of a description, which says what a bucket is. */
const bucketName = (description: string): string => {
  const cut = description.indexOf(";");
  return cut === -1 ? description : description.slice(0, cut);
};

/** A name split into the folder it shares and the part that tells it apart. */
export type NameParts = { readonly dir: string; readonly base: string };

const parentOf = (path: string): string =>
  path.slice(0, path.lastIndexOf("/") + 1);

/**
 * A group joins paths with ` + `. When they all sit in one folder, that
 * folder is named once: `packages/a/x + packages/a/y` is `x + y` in `packages/a/`.
 */
const groupParts = (path: string): NameParts => {
  const paths = path.split(" + ");
  const [first] = paths;
  const dir = first === undefined ? "" : parentOf(first);
  if (dir === "" || !paths.every((member) => parentOf(member) === dir)) {
    return { dir: "", base: path };
  }
  return {
    dir,
    base: paths.map((member) => member.slice(dir.length)).join(" + "),
  };
};

const splitParts = (path: string): NameParts => {
  const dir = parentOf(path);
  return { dir, base: path.slice(dir.length) };
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
