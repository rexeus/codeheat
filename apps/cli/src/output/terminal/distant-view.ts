// Owns the terminal view of where change crosses the design: file pairs that
// change together far apart, and modules that change together as a group.
import type { Report } from "@codeheat/engine";

import { escapeForTerminal } from "../escape.js";
import { percent } from "./format.js";
import { importsCell } from "./imports-cell.js";
import type { Style } from "./style.js";
import { plain, renderTable } from "./table.js";

const TOP_DISTANT = 5;
const TOP_CLIQUES = 3;

const distantTable = (report: Report, style: Style): ReadonlyArray<string> =>
  renderTable(
    [
      { header: "score", align: "right" },
      { header: "degree", align: "right" },
      { header: "shared", align: "right" },
      { header: "imports", align: "left" },
      { header: "files", align: "left" },
    ],
    report.distantCouplings
      .slice(0, TOP_DISTANT)
      .map((pair) => [
        plain(pair.score.toFixed(2)),
        plain(percent(pair.strength)),
        plain(String(pair.sharedCommits)),
        importsCell(pair, style),
        plain(`${escapeForTerminal(pair.a)} <-> ${escapeForTerminal(pair.b)}`),
      ]),
    style,
  );

/**
 * The "Distant coupling" section, with its heading and a closing blank line: a
 * table of the five best ranked distant couplings (see
 * `Report.distantCouplings`), hidden couplings marked as such. None when the
 * report has no distant coupling.
 */
export const distantSection = (
  report: Report,
  style: Style,
): ReadonlyArray<string> =>
  report.distantCouplings.length === 0
    ? []
    : [
        style.bold(
          "Distant coupling (across modules or far apart, tests excluded)",
        ),
        ...distantTable(report, style),
        "",
      ];

/**
 * The "Change together" section, with its heading and a closing blank line:
 * one line per clique (see `Report.cliques`), at most three, the members
 * joined by `+` and followed by the clique's reason, and a note counting the
 * cliques left out, and a note when the search for cliques was cut short
 * (`Report.cliquesPartial`). None when the report has neither.
 */
export const cliqueSection = (
  report: Report,
  style: Style,
): ReadonlyArray<string> => {
  if (report.cliques.length === 0 && !report.cliquesPartial) {
    return [];
  }
  const shown = report.cliques.slice(0, TOP_CLIQUES);
  const hidden = report.cliques.length - shown.length;
  return [
    style.bold("Change together (modules)"),
    ...shown.map(
      ({ modules, reason }) =>
        `${modules.map((path) => escapeForTerminal(path)).join(" + ")}: ${escapeForTerminal(reason)}`,
    ),
    ...(hidden > 0 ? [`+${hidden} more; see cliques in --json`] : []),
    ...(report.cliquesPartial
      ? [
          style.dim(
            "The search was cut short; a clique may be missing (cliquesPartial in --json).",
          ),
        ]
      : []),
    "",
  ];
};
