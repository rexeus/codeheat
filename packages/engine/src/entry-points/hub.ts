// Owns the entry points of kind `hub`: unstable interfaces many files depend on.
import { MIN_SHARED_COMMITS } from "../coupling/coupling.js";
import type { UnstableInterface } from "../report/unstable-interface.js";
import { evidenceOf } from "./candidate.js";
import type { Candidate } from "./candidate.js";
import { HUB_VERDICT, hubMove } from "./moves.js";

/**
 * The unstable interfaces (see `UnstableInterface`) that changed together
 * with at least `MIN_SHARED_COMMITS` of their dependents. The score is
 * `ripple × activity`: `ripple` is the share of the file's dependents that
 * changed together with it, and `activity` the share of all counted changes
 * (`changes`) that touched the file. `territoryOf` maps a path to its finest
 * territory.
 */
export const hubEntries = (
  interfaces: ReadonlyArray<UnstableInterface>,
  territoryOf: ReadonlyMap<string, string>,
  changes: number,
): ReadonlyArray<Candidate> =>
  interfaces.flatMap((hub): Array<Candidate> => {
    if (hub.changedDependents < MIN_SHARED_COMMITS || changes === 0) {
      return [];
    }
    const territory = territoryOf.get(hub.path);
    return [
      {
        kind: "hub",
        score: (hub.changedDependents / hub.fanIn) * (hub.changes / changes),
        territories: territory === undefined ? [] : [territory],
        files: [hub.path],
        evidence: evidenceOf({
          fanIn: hub.fanIn,
          changes: hub.changes,
          medianDependentChanges: hub.medianDependentChanges,
          changedDependents: hub.changedDependents,
        }),
        verdict: HUB_VERDICT,
        designMove: hubMove(hub.path),
      },
    ];
  });
