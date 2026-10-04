// Owns the words of an entry point: one fixed verdict and one design move per
// kind, with the names filled in. The moves are rules, not generated text.

const SHOWN_NAMES = 3;

/** `a`, `a and b`, `a, b, and c`, or `a, b, c, and 2 more`. */
const listed = (names: ReadonlyArray<string>): string => {
  const shown = names.slice(0, SHOWN_NAMES);
  const more = names.length - shown.length;
  const all = more > 0 ? [...shown, `${more} more`] : shown;
  if (all.length <= 2) {
    return all.join(" and ");
  }
  return `${all.slice(0, -1).join(", ")}, and ${all.at(-1) ?? ""}`;
};

/** Says the boundary does not hold, and how it moves when the territory also erodes. */
export const boundaryVerdict = (eroding: boolean): string =>
  eroding
    ? "The boundary does not hold, and it holds less than it used to: changes here keep reaching into other territories."
    : "The boundary does not hold: changes here keep reaching into other territories.";

/** Move a boundary; `partner` is the path of the territory its changes most often reach into. */
export const boundaryMove = (path: string, partner: string): string =>
  `Move a boundary: bring what changes together with ${path} into one territory, or give the part they share a home of its own; start with ${partner}.`;

/** Says the boundary between the territories at paths `a` and `b`, each the other's leak target, does not hold. */
export const boundaryPairVerdict = (
  a: string,
  b: string,
  eroding: boolean,
): string =>
  `The boundary between ${a} and ${b} does not hold${eroding ? ", and it holds less than it used to" : ""}: changes in one keep reaching into the other.`;

/** Move the boundary between the territories at paths `a` and `b`. */
export const boundaryPairMove = (a: string, b: string): string =>
  `Move a boundary: redraw the boundary between ${a} and ${b}, or give what they share a home of its own.`;

export const HOTSPOT_VERDICT =
  "Chronic hotspot: the same files stay among the hottest quarter after quarter.";

/** Split a hotspot; `files` are its chronic hotspots, hottest first. */
export const hotspotMove = (files: ReadonlyArray<string>): string =>
  `Split a hotspot: break ${listed(files)} into parts that each change for one reason.`;

export const CLIQUE_VERDICT =
  "These territories change as one unit across their boundaries.";

/** Extract a shared abstraction for the `paths` of a clique's territories. */
export const cliqueMove = (paths: ReadonlyArray<string>): string =>
  `Extract a shared abstraction: find what ${listed(paths)} all change for and give it one home that they use, or redraw the boundaries around it.`;

export const COPIES_VERDICT = "These files are copies that change in lockstep.";

export const COPIES_MOVE =
  "Extract a shared abstraction: replace the copies with one shared implementation, or generate them from one source.";

export const HUB_VERDICT =
  "Many files depend on this file, and it keeps changing.";

/** Break up a hub: `path` is the unstable interface. */
export const hubMove = (path: string): string =>
  `Break up a hub: split what keeps changing in ${path} from what many files rely on, so that a change no longer ripples into its dependents.`;

export const COUPLING_VERDICT =
  "These files keep changing together across territories, and no import links them.";

/** Centralize a contract between the two files `a` and `b` that change together without an import. */
export const couplingMove = (a: string, b: string): string =>
  `Centralize a contract: ${a} and ${b} agree on something that neither shows to the other; define it once, in a place both use.`;
