// Owns the entry points of kind `hub`: unstable interfaces many files depend on.
import type { UnstableInterface } from "../report/unstable-interface.js";
import { evidenceOf } from "./candidate.js";
import type { Candidate } from "./candidate.js";
import type { EntryLimits } from "./limits.js";
import { HUB_VERDICT, hubMove } from "./moves.js";

/**
 * The unstable interfaces (see `UnstableInterface`) that changed together
 * with at least `limits.minEntryChanges` of their dependents. The score is
 * the share of all the heat that the hub and the dependents the report lists
 * for it (`UnstableInterface.dependents`, at most five) hold (`heatShareOf`
 * gives it for a set of paths) times `ripple`, the share of the hub's
 * dependents that changed together with it. `territoryOf` maps a path to its
 * finest territory.
 */
export const hubEntries = (
  interfaces: ReadonlyArray<UnstableInterface>,
  territoryOf: ReadonlyMap<string, string>,
  heatShareOf: (paths: Iterable<string>) => number,
  limits: EntryLimits,
): ReadonlyArray<Candidate> =>
  interfaces.flatMap((hub): Array<Candidate> => {
    if (hub.changedDependents < limits.minEntryChanges) {
      return [];
    }
    const territory = territoryOf.get(hub.path);
    const heatShare = heatShareOf([
      hub.path,
      ...hub.dependents.map(({ path }) => path),
    ]);
    return [
      {
        kind: "hub",
        score: heatShare * (hub.changedDependents / hub.fanIn),
        territories: territory === undefined ? [] : [territory],
        files: [hub.path],
        evidence: evidenceOf({
          heatShare,
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
