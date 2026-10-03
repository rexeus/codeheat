// Owns the part of an analysis that reads files beyond the history: the latest
// window's couplings with their import relations, and what is derived from them.
import { Effect } from "effect";

import type { LanguageAdapter } from "../code/language-adapter.js";
import { findCopyFamilies } from "../copies/find-copy-families.js";
import { distantCouplings } from "../distant/distant-couplings.js";
import { linkCouplings } from "../imports/link-couplings.js";
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
    const couplings = yield* linkCouplings(
      {
        ...place,
        universe: new Set(universe.files.map((file) => file.path)),
        adapters,
      },
      coupled.couplings,
    );
    const copyFamilies = yield* findCopyFamilies(
      place.root,
      couplings,
      histories.current,
    );
    return {
      ...measureWindows(universe, histories, { ...coupled, couplings }),
      copyFamilies,
      distantCouplings: distantCouplings(
        couplings,
        new Map([...universe.modules, ...universe.contracts]),
      ),
    };
  });
