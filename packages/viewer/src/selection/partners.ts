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
};

/** Partners of every coupled file, strongest first. */
export type PartnerIndex = ReadonlyMap<string, readonly Partner[]>;

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
  for (const { a, b, ...measures } of couplings) {
    add(a, { path: b, ...measures });
    add(b, { path: a, ...measures });
  }
  for (const partners of index.values()) {
    partners.sort((left, right) => right.degree - left.degree);
  }
  return index;
};
