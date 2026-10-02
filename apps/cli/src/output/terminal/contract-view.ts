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

/** A coupled file's path, marked when it is a contract file, which is no hotspot and has no tile. */
export const coupledPath = (
  path: string,
  kind: Coupling["kinds"]["a"],
): string =>
  escapeForTerminal(path) + (kind === "contract" ? " (contract)" : "");

/**
 * The contract files that were left out of coupling for changing in most
 * commits, with their share; no lines when there are none.
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
    `Left out for changing in over ${percent(thresholds.ubiquitousShare)} of commits: ${shown.join(", ")}${hidden > 0 ? ` +${hidden} more` : ""}`,
  ];
};
