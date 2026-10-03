// Owns the terminal view of the scaling signals: files many others import that
// keep changing, and imports that point from stable modules to volatile ones.
import type { Report } from "@codeheat/engine";

import { escapeForTerminal } from "../escape.js";
import type { Style } from "./style.js";
import { plain, renderTable } from "./table.js";

const commits = (count: number): string =>
  `${count} ${count === 1 ? "commit" : "commits"}`;

const TOP_INTERFACES = 5;
const TOP_DIRECTIONS = 3;

const interfaceTable = (
  report: Report,
  style: Style,
): ReadonlyArray<string> => [
  ...renderTable(
    [
      { header: "fan-in", align: "right" },
      { header: "commits", align: "right" },
      { header: "ripple", align: "right" },
      { header: "file", align: "left" },
    ],
    report.unstableInterfaces
      .slice(0, TOP_INTERFACES)
      .map((found) => [
        plain(String(found.fanIn)),
        plain(String(found.revisions)),
        plain(String(found.changedDependents)),
        plain(escapeForTerminal(found.path)),
      ]),
    style,
  ),
  style.dim(
    "fan-in: files that import it; ripple: of those, files that changed in the same commits",
  ),
];

/**
 * The "Unstable interfaces" section, with its heading and a closing blank
 * line: a table of the five files (see `Report.unstableInterfaces`) that the
 * most dependents changed along with, and a note on the columns. None when the
 * report has none.
 */
const interfaceSection = (
  report: Report,
  style: Style,
): ReadonlyArray<string> =>
  report.unstableInterfaces.length === 0
    ? []
    : [
        style.bold(
          "Unstable interfaces (many files import them, and they keep changing)",
        ),
        ...interfaceTable(report, style),
        "",
      ];

/**
 * The "Dependency direction" section, with its heading and a closing blank
 * line: a line for each of the three edges (see `Report.dependencyDirection`)
 * with the most importing files, and a note counting the others. None when the
 * report has none.
 */
const directionSection = (
  report: Report,
  style: Style,
): ReadonlyArray<string> => {
  if (report.dependencyDirection.length === 0) {
    return [];
  }
  const shown = report.dependencyDirection.slice(0, TOP_DIRECTIONS);
  const hidden = report.dependencyDirection.length - shown.length;
  return [
    style.bold(
      "Dependency direction (modules that rarely change import ones that change often)",
    ),
    ...shown.map(
      ({
        from,
        to,
        importingFiles,
        changedImporters,
        fromCommits,
        toCommits,
      }) =>
        `${escapeForTerminal(from)} (${commits(fromCommits)}) imports ${escapeForTerminal(to)} (${commits(toCommits)}) in ${importingFiles} ${importingFiles === 1 ? "file" : "files"}; changed together in ${commits(changedImporters)}`,
    ),
    ...(hidden > 0
      ? [`+${hidden} more; see dependencyDirection in --json`]
      : []),
    "",
  ];
};

/** The scaling sections one after the other: unstable interfaces, then dependency direction; none for what the report lacks. */
export const stabilitySections = (
  report: Report,
  style: Style,
): ReadonlyArray<string> => [
  ...interfaceSection(report, style),
  ...directionSection(report, style),
];
