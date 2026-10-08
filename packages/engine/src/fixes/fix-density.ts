// Owns how much of the change is fixing: the share of the counted changes
// whose subject marks a fix, for the repository and for each module.
import type { LogicalChange } from "../changes/logical-change.js";
import type { FixDensity } from "../model/fix-density.js";
import type { Module } from "../model/module.js";
import { roundReported } from "../model/precision.js";

/**
 * The least share of the changes that must follow a commit convention for
 * their subjects to say anything: below it a team writes free text, and a
 * fix share read from it would be a number of how often it writes the word
 * "fix".
 */
export const MIN_CONVENTION_SHARE = 0.05;

type Tally = { changes: number; fixes: number; spanning: number };

/** Credits one change, given the distinct modules it touched, to each of them. */
const countChange = (
  tallies: Map<string, Tally>,
  touched: ReadonlySet<string>,
  fix: boolean,
  testOnly: ReadonlySet<string>,
): void => {
  const spans = [...touched].filter((path) => !testOnly.has(path)).length > 1;
  for (const path of touched) {
    const tally = tallies.get(path) ?? { changes: 0, fixes: 0, spanning: 0 };
    tally.changes += 1;
    tally.fixes += fix ? 1 : 0;
    tally.spanning += fix && spans && !testOnly.has(path) ? 1 : 0;
    tallies.set(path, tally);
  }
};

/**
 * Measures the fix density of the repository and sets `fixDensity` on every
 * module. `changes` are the counted changes of the window and `touched` the
 * distinct modules each touched, in the same order (see `touchedModules`).
 * Nothing is reported per module while the repository's is not `known` (see
 * `FixDensity`); a test-only module or one no change touched has none either.
 * Any area with a `path` and a `testOnly` flag can stand in for a module, as
 * long as `touched` names the same paths.
 */
export const measureFixes = <Area extends Pick<Module, "path" | "testOnly">>(
  changes: ReadonlyArray<LogicalChange>,
  touched: ReadonlyArray<ReadonlySet<string>>,
  modules: ReadonlyArray<Area>,
): {
  readonly fixDensity: FixDensity;
  readonly modules: ReadonlyArray<Area & Pick<Module, "fixDensity">>;
} => {
  const fixes = changes.filter(({ subjectKind }) => subjectKind === "fix");
  const conventional = changes.filter(
    ({ subjectKind }) => subjectKind !== "other",
  );
  const known =
    changes.length > 0 &&
    conventional.length / changes.length >= MIN_CONVENTION_SHARE;
  const testOnly = new Set(
    modules.filter((module) => module.testOnly).map(({ path }) => path),
  );
  const tallies = new Map<string, Tally>();
  if (known) {
    for (const [index, change] of changes.entries()) {
      countChange(
        tallies,
        touched[index] ?? new Set(),
        change.subjectKind === "fix",
        testOnly,
      );
    }
  }
  return {
    fixDensity: {
      changes: changes.length,
      fixes: fixes.length,
      conventional:
        changes.length === 0
          ? 0
          : roundReported(conventional.length / changes.length),
      known,
      share: known ? roundReported(fixes.length / changes.length) : null,
    },
    modules: modules.map((module) => {
      const tally = tallies.get(module.path);
      return {
        ...module,
        fixDensity:
          tally === undefined || module.testOnly
            ? null
            : {
                fixes: tally.fixes,
                share: roundReported(tally.fixes / tally.changes),
                spanning: tally.spanning,
              },
      };
    }),
  };
};
