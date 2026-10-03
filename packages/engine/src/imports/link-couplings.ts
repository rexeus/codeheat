// Owns telling hidden coupling from visible: for each coupled pair, whether a
// static import connects the two files, and whether we can tell.
import type { Coupling } from "../report/report.js";
import type { ImportGraph } from "./import-graph.js";

const relation = (
  forward: boolean,
  backward: boolean,
): Exclude<Coupling["imports"], null> => {
  if (forward && backward) {
    return "both";
  }
  if (forward) {
    return "a→b";
  }
  return backward ? "b→a" : "none";
};

/**
 * An import in either direction is certain. No import is only certain when
 * every module that the two files, and what they re-export through, load is
 * accounted for; otherwise the missing one may be the import.
 */
const importsOf = (
  { a, b }: Coupling,
  { links, reach }: ImportGraph,
): Coupling["imports"] => {
  const from = links.get(a);
  const to = links.get(b);
  if (from === undefined || to === undefined) {
    return null;
  }
  const forward = reach(a);
  const backward = reach(b);
  const found = relation(forward.files.has(b), backward.files.has(a));
  const everythingKnown =
    from.complete && to.complete && forward.known && backward.known;
  return found === "none" && !everythingKnown ? null : found;
};

/**
 * Sets `imports` on every coupling: which of its two files imports the other,
 * directly or through the re-exports of the module it imports, `none` when
 * neither does and every import involved is accounted for (see
 * `ModuleLinks.complete`), and null when it cannot be told. `graph` must have
 * been read for at least the coupled files. A coupling where either file is
 * not read by an adapter or does not parse is null.
 */
export const linkCouplings = (
  graph: ImportGraph,
  couplings: ReadonlyArray<Coupling>,
): ReadonlyArray<Coupling> =>
  couplings.map((coupling) => ({
    ...coupling,
    imports: importsOf(coupling, graph),
  }));
