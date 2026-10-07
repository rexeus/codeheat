// Owns the terminal view of where change crosses the design: file pairs that
// change together far apart, and modules that change together as a group.
import type { Coupling, FileStats, Analysis } from "@codeheat/engine";

import { escapeForTerminal } from "../escape.js";
import { coupledPath, isContractPair } from "./contract-view.js";
import { percent } from "./format.js";
import { importsCell } from "./imports-cell.js";
import type { Style } from "./style.js";
import { plain, renderTable } from "./table.js";

const TOP_DISTANT = 5;
const TOP_CLIQUES = 3;
const TOP_COUPLINGS = 5;

const distantTable = (report: Analysis, style: Style): ReadonlyArray<string> =>
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
 * `Analysis.distantCouplings`), hidden couplings marked as such. The heading says
 * what distant means: other modules, or `thresholds.minLocalDistance`
 * directories apart within one. None when the report has no distant coupling.
 */
export const distantSection = (
  report: Analysis,
  style: Style,
): ReadonlyArray<string> =>
  report.distantCouplings.length === 0
    ? []
    : [
        style.bold(
          `Distant coupling (in different modules, or at least ${report.thresholds.minLocalDistance} directories apart within one module; tests excluded)`,
        ),
        ...distantTable(report, style),
        "",
      ];

/**
 * The "Change together" section, with its heading and a closing blank line:
 * one line per clique (see `Analysis.cliques`), at most three, the members
 * joined by `+` and followed by the clique's reason, and a note counting the
 * cliques left out, and a note when the search for cliques was cut short
 * (`Analysis.cliquesPartial`). None when the report has neither.
 */
export const cliqueSection = (
  report: Analysis,
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

/** The five strongest couplings that are neither test pairs nor pairs of two contract files, with the co-change probability in both directions. */
export const couplingLines = (
  couplings: ReadonlyArray<Coupling>,
  files: ReadonlyArray<FileStats>,
  contracts: Analysis["contracts"],
  style: Style,
): ReadonlyArray<string> => {
  const changes = new Map(
    [...files, ...contracts].map((file) => [file.path, file.changes]),
  );
  const coChange = (coupling: Coupling, from: string): string => {
    const total = changes.get(from);
    if (total === undefined) {
      throw new Error(
        `Coupled file ${escapeForTerminal(from)} is missing from the report's files and contracts; render an untruncated report.`,
      );
    }
    return percent(coupling.sharedCommits / total);
  };
  return renderTable(
    [
      { header: "degree", align: "right" },
      { header: "shared", align: "right" },
      { header: "distance", align: "right" },
      { header: "a → b", align: "right" },
      { header: "b → a", align: "right" },
      { header: "imports", align: "left" },
      { header: "files", align: "left" },
    ],
    couplings
      .filter((coupling) => !coupling.testPair && !isContractPair(coupling))
      .slice(0, TOP_COUPLINGS)
      .map((coupling) => [
        plain(percent(coupling.degree)),
        plain(String(coupling.sharedCommits)),
        plain(String(coupling.distance)),
        plain(coChange(coupling, coupling.a)),
        plain(coChange(coupling, coupling.b)),
        importsCell(coupling, style),
        plain(
          `${coupledPath(coupling.a, coupling.kinds.a)} <-> ${coupledPath(coupling.b, coupling.kinds.b)}`,
        ),
      ]),
    style,
  );
};
