// Owns the contract files' own record in the report: where they live and how
// often they changed. They get no score, so this is all the report says of one.
import { Order } from "effect";

import type { History } from "../history/history.js";
import type { ContractFile } from "../model/contract-file.js";
import type { ModuleRef } from "../modules/detect.js";

/**
 * Every contract file with its window activity, most revised first, ties by
 * path. `homes` maps each contract file to its module.
 */
export const measureContracts = (
  homes: ReadonlyMap<string, ModuleRef>,
  { files }: Pick<History, "files">,
): ReadonlyArray<ContractFile> =>
  [...homes]
    .map(([path, { path: module }]) => {
      const activity = files.get(path);
      return {
        path,
        module,
        revisions: activity?.revisions ?? 0,
        changes: activity?.changes ?? 0,
        linesAdded: activity?.linesAdded ?? 0,
        linesDeleted: activity?.linesDeleted ?? 0,
      };
    })
    .toSorted(
      (a, b) => b.revisions - a.revisions || Order.String(a.path, b.path),
    );
