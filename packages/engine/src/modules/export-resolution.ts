// Owns what a name exported by a file stands for, following ECMAScript's
// ResolveExport: a file's own exports win over `export *`, `default` is never
// forwarded, a cycle resolves to nothing, and a name that two `export *`
// sources export as different bindings is ambiguous, so it is not exported.
import type { SourceExports } from "../code/language-adapter.js";

type Binding = SourceExports["names"][number]["binding"];

/** What `resolveExport` found for a name. */
export type Resolution =
  | {
      readonly kind: "binding";
      /** Equal ids are the same binding. */
      readonly id: string;
      /** The id names the binding where it is declared. Otherwise the chain was cut (a file that was not loaded, a specifier that names no single file) and the id names the hop it was cut at, which may differ from the id of the same binding reached another way. */
      readonly exact: boolean;
    }
  | { readonly kind: "ambiguous" }
  | { readonly kind: "missing" }
  /** A hop could not be followed and the answer depends on it. */
  | { readonly kind: "unknown" };

/** What resolving reads: the exports of the files loaded so far, and how specifiers name files. */
export type ExportWorld = {
  readonly loaded: ReadonlyMap<string, SourceExports>;
  /** The universe file that `specifier`, written in `from`, names, when it is exactly one. */
  readonly fileOf: (from: string, specifier: string) => string | undefined;
};

const MISSING: Resolution = { kind: "missing" };
const AMBIGUOUS: Resolution = { kind: "ambiguous" };
const UNKNOWN: Resolution = { kind: "unknown" };

const binding = (id: string, exact: boolean): Resolution => ({
  kind: "binding",
  id,
  exact,
});

/** Merges what the `export *` sources of one file say about a name. */
const combine = (results: ReadonlyArray<Resolution>): Resolution => {
  const found = results.filter(({ kind }) => kind !== "missing");
  const bindings = found.filter((result) => result.kind === "binding");
  const exactIds = new Set(
    bindings.filter(({ exact }) => exact).map(({ id }) => id),
  );
  // Two exact bindings that differ settle it, whatever else the sources say;
  // checking this first keeps the answer independent of the order of visits.
  if (found.some(({ kind }) => kind === "ambiguous") || exactIds.size > 1) {
    return AMBIGUOUS;
  }
  if (found.some(({ kind }) => kind === "unknown")) {
    return UNKNOWN;
  }
  const [first] = bindings;
  if (first === undefined) {
    return MISSING;
  }
  if (bindings.every(({ id }) => id === first.id)) {
    return binding(
      first.id,
      bindings.every(({ exact }) => exact),
    );
  }
  return bindings.every(({ exact }) => exact) ? AMBIGUOUS : UNKNOWN;
};

const resolveBinding = (
  world: ExportWorld,
  file: string,
  { binding: origin }: { readonly binding: Binding },
  seen: Set<string>,
): Resolution => {
  if ("local" in origin) {
    return binding(`${file}#${origin.local}`, true);
  }
  // A package is the same binding wherever the specifier is written.
  if (!origin.specifier.startsWith(".")) {
    return binding(`ext:${origin.specifier}#${origin.name}`, true);
  }
  const target = world.fileOf(file, origin.specifier);
  if (target === undefined) {
    // An asset, a missing or excluded file: the name is certain, only what it stands for is out of sight.
    return binding(`${file}\0${origin.specifier}#${origin.name}`, false);
  }
  return origin.name === "*"
    ? binding(`${target}#*`, true)
    : resolveExport(world, target, origin.name, seen);
};

/**
 * What `name` stands for in the exports of `file`: its own export of that
 * name, else what its `export *` sources agree on. A file that was not loaded
 * resolves to itself, inexactly.
 *
 * `seen` is ECMAScript's resolve set, shared by the whole resolution: a name
 * of a file is looked at once, so the cost is linear in the files reached,
 * however many ways lead to one. Whoever reaches it a second time gets
 * `missing`, which is right because the first visit already contributed its
 * answer to the same resolution.
 */
export const resolveExport = (
  world: ExportWorld,
  file: string,
  name: string,
  seen: Set<string> = new Set(),
): Resolution => {
  const key = `${file}\0${name}`;
  if (seen.has(key)) {
    return MISSING;
  }
  const listed = world.loaded.get(file);
  if (listed === undefined) {
    return binding(`${file}#${name}`, false);
  }
  seen.add(key);
  const own = listed.names.find((exported) => exported.name === name);
  if (own !== undefined) {
    return resolveBinding(world, file, own, seen);
  }
  if (name === "default") {
    return MISSING;
  }
  return combine(
    listed.forwarded.map((specifier) => {
      const target = world.fileOf(file, specifier);
      return target === undefined
        ? UNKNOWN
        : resolveExport(world, target, name, seen);
    }),
  );
};
