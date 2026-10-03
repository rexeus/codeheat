// Owns the part of an analysis that reads files beyond the history: the latest
// window's couplings with their import relations, and what is derived from them.
import { Effect } from "effect";

import type { LanguageAdapter } from "../code/language-adapter.js";
import { findCopyFamilies } from "../copies/find-copy-families.js";
import { distantCouplings } from "../distant/distant-couplings.js";
import { readImportGraph } from "../imports/import-graph.js";
import { linkCouplings } from "../imports/link-couplings.js";
import { measureDesignFit } from "./measure-design-fit.js";
import { measureStability } from "./measure-stability.js";
import { measureTerritorial } from "./measure-territorial.js";
import { coupleHistory, measureWindows } from "./measure.js";
import type { Universe } from "./measure.js";
import type { WindowHistories } from "./windows.js";

/**
 * Measures the windows; the latest window's couplings come with their import
 * relations. Imports are read among the code files: a contract is an asset to
 * the code that loads it, and its own coupling's relation is unknown.
 */
export const measureLinked = (
  adapters: ReadonlyArray<LanguageAdapter>,
  place: { readonly root: string; readonly scope: string },
  universe: Universe,
  histories: WindowHistories,
) =>
  Effect.gen(function* () {
    const coupled = coupleHistory(histories.current, universe);
    const graph = yield* readImportGraph(
      {
        ...place,
        universe: new Set(universe.files.map((file) => file.path)),
        adapters,
      },
      new Set(coupled.couplings.flatMap(({ a, b }) => [a, b])),
    );
    const couplings = linkCouplings(graph, coupled.couplings);
    const copyFamilies = yield* findCopyFamilies(
      place.root,
      couplings,
      histories.current,
    );
    const measured = measureWindows(universe, histories, {
      ...coupled,
      couplings,
    });
    const stability = yield* measureStability(graph, universe, histories, {
      modules: measured.modules,
      minModuleCommits: measured.thresholds.minModuleCommits,
    });
    const designFit = measureDesignFit(
      universe,
      histories,
      measured,
      couplings,
    );
    const territorial = yield* measureTerritorial({
      ...place,
      packages: universe.packages,
      files: designFit.files,
      couplings,
      copyFamilies,
      unstableInterfaces: stability.unstableInterfaces,
      changes: measured.couplingCommits,
      histories,
      minChanges: measured.thresholds.minModuleCommits,
    });
    return {
      ...measured,
      ...designFit,
      ...territorial,
      copyFamilies,
      distantCouplings: distantCouplings(
        couplings,
        new Map([...universe.modules, ...universe.contracts]),
      ),
      ...stability,
    };
  });
