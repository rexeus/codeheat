// Owns the entry points of kind `hub`: unstable interfaces many files depend on.
import type { UnstableInterface } from "../report/unstable-interface.js";
import { evidenceOf } from "./candidate.js";
import type { Candidate } from "./candidate.js";
import type { FileHeat } from "./file-heat.js";
import type { EntryLimits } from "./limits.js";
import { HUB_VERDICT, hubMove } from "./moves.js";

/**
 * The unstable interfaces (see `UnstableInterface`) that changed together
 * with at least `limits.minEntryChanges` of their dependents. The heat at
 * stake is that of the hub plus, for each dependent the report lists
 * (`UnstableInterface.dependents`, at most five), the share of its heat that
 * went along with the hub (`sharedCommits` of the dependent's changes);
 * `heat.weighted` gives it as a share of all the heat. The score is that share
 * times `ripple`, the share of the hub's dependents that changed together with
 * it. `territoryOf` maps a path to its finest territory.
 */
export const hubEntries = (
  interfaces: ReadonlyArray<UnstableInterface>,
  territoryOf: ReadonlyMap<string, string>,
  heat: FileHeat,
  limits: EntryLimits,
): ReadonlyArray<Candidate> =>
  interfaces.flatMap((hub): Array<Candidate> => {
    if (hub.changedDependents < limits.minEntryChanges) {
      return [];
    }
    const territory = territoryOf.get(hub.path);
    const heatShare = heat.weighted([
      [hub.path, 1],
      ...hub.dependents.map(({ path, sharedCommits }): [string, number] => [
        path,
        Math.min(1, sharedCommits / Math.max(1, heat.changesOf(path))),
      ]),
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
