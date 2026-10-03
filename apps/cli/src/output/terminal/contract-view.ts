// Owns how the terminal says that part of the universe is contract files:
// interface definitions and schemas, which couple with code but are no hotspots.
import type { Coupling, Report } from "@codeheat/engine";

import { escapeForTerminal } from "../escape.js";
import { percent } from "./format.js";

const SHOWN_UBIQUITOUS = 3;

/** How many contract files the analysis also read, to append to the universe size; nothing without any. */
export const contractNote = (report: Report): string => {
  const { contracts } = report.totals;
  return contracts === 0
    ? ""
    : `, ${contracts} contract ${contracts === 1 ? "file" : "files"}`;
};

/** Both files are contract files: the files of one API definition changing together, which the coupling table leaves out like test pairs. */
export const isContractPair = ({ kinds }: Coupling): boolean =>
  kinds.a === "contract" && kinds.b === "contract";

/** A coupled file's path, marked when it is a contract file, which is no hotspot and has no tile. */
export const coupledPath = (
  path: string,
  kind: Coupling["kinds"]["a"],
): string =>
  escapeForTerminal(path) + (kind === "contract" ? " (contract)" : "");

/**
 * A module partner's name, marked when it is no module but a place that holds
 * only contract files (a code-free `spec/` folder): why a design-first module
 * changes with something outside every module.
 */
export const partnerName = (partner: {
  readonly path: string;
  readonly contractsOnly: boolean;
}): string =>
  escapeForTerminal(partner.path) +
  (partner.contractsOnly ? " (contracts)" : "");

/**
 * The contract files that were left out of coupling for changing in most
 * changes, with their share; no lines when there are none.
 */
export const ubiquitousLines = (report: Report): ReadonlyArray<string> => {
  const { ubiquitousFiles, thresholds } = report;
  if (ubiquitousFiles.length === 0) {
    return [];
  }
  const shown = ubiquitousFiles
    .slice(0, SHOWN_UBIQUITOUS)
    .map((file) => `${escapeForTerminal(file.path)} (${percent(file.share)})`);
  const hidden = ubiquitousFiles.length - shown.length;
  return [
    `Left out for changing in over ${percent(thresholds.ubiquitousShare)} of changes: ${shown.join(", ")}${hidden > 0 ? ` +${hidden} more` : ""}`,
  ];
};
