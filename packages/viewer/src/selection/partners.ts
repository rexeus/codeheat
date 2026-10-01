import type { Coupling } from "@codeheat/engine";

/** A file that changes together with the selected file. */
export type Partner = {
  readonly path: string;
  readonly sharedCommits: number;
  readonly degree: number;
  readonly distance: number;
  readonly testPair: boolean;
  /** The partner lives in another module. */
  readonly crossesModule: boolean;
  /**
   * Whether an import links the files, seen from the selected file:
   * `file→partner` means the selected file imports the partner. `none` is
   * hidden coupling; null when unknown.
   */
  readonly imports: "file→partner" | "partner→file" | "both" | "none" | null;
};

/** Partners of every coupled file, strongest first. */
export type PartnerIndex = ReadonlyMap<string, readonly Partner[]>;

/** `imports` of a coupling seen from `a` (`fromA`) or from `b`. */
const importsSeenFrom = (
  imports: Coupling["imports"],
  fromA: boolean,
): Partner["imports"] => {
  if (imports === "a→b" || imports === "b→a") {
    return (imports === "a→b") === fromA ? "file→partner" : "partner→file";
  }
  return imports;
};

/** Couplings are symmetric: each one is listed under both of its files. */
export const indexPartners = (couplings: readonly Coupling[]): PartnerIndex => {
  const index = new Map<string, Partner[]>();
  const add = (path: string, partner: Partner): void => {
    const partners = index.get(path);
    if (partners === undefined) {
      index.set(path, [partner]);
    } else {
      partners.push(partner);
    }
  };
  for (const { a, b, imports, ...measures } of couplings) {
    add(a, { path: b, ...measures, imports: importsSeenFrom(imports, true) });
    add(b, { path: a, ...measures, imports: importsSeenFrom(imports, false) });
  }
  for (const partners of index.values()) {
    partners.sort((left, right) => right.degree - left.degree);
  }
  return index;
};
