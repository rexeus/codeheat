// Owns the terminal's section on modules whose interface leaks: changes inside
// them that keep changing their public entry points too.
import type { Module, Report } from "@codeheat/engine";

import { escapeForTerminal } from "../escape.js";
import { percent } from "./format.js";
import type { Style } from "./style.js";
import { plain, renderTable } from "./table.js";

const TOP_MODULES = 5;
const SHOWN_ENTRY_POINTS = 2;

const entryPointNote = (entryPoints: ReadonlyArray<string>): string => {
  const shown = entryPoints
    .slice(0, SHOWN_ENTRY_POINTS)
    .map((entry) => escapeForTerminal(entry));
  const hidden = entryPoints.length - shown.length;
  return hidden > 0 ? `${shown.join(", ")} +${hidden} more` : shown.join(", ");
};

const leakageLines = (
  modules: ReadonlyArray<Module>,
  style: Style,
): ReadonlyArray<string> =>
  renderTable(
    [
      { header: "leakage", align: "right" },
      { header: "changes", align: "right" },
      { header: "module", align: "left" },
      { header: "entry points", align: "left" },
    ],
    modules.map((module) => [
      plain(percent(module.leakage ?? 0)),
      plain(String(module.implementationCommits)),
      plain(escapeForTerminal(module.path)),
      plain(entryPointNote(module.entryPoints)),
    ]),
    style,
  );

/** The first modules the report flags as having a leaky interface, in the report's order. */
const leakyModules = (report: Report): ReadonlyArray<Module> =>
  report.modules
    .filter((module) => module.leakyInterface)
    .slice(0, TOP_MODULES);

/** The "Leaky interfaces" section: a table of the first leaky modules, or the sentence that there are none, and a closing blank line. */
export const leakySection = (
  report: Report,
  style: Style,
): ReadonlyArray<string> => {
  const leaky = leakyModules(report);
  return [
    style.bold("Leaky interfaces"),
    ...(leaky.length > 0
      ? leakageLines(leaky, style)
      : ["No module has a leaky interface."]),
    "",
  ];
};
