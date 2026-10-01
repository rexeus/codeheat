// Owns the human view of `analyze`: top hotspots, top couplings, one hint.
import type { Coupling, FileStats, Report } from "@codeheat/engine";

import { escapeForTerminal } from "../escape.js";
import { day, percent } from "./format.js";
import type { Style } from "./style.js";
import { plain, renderTable } from "./table.js";

const TOP_HOTSPOTS = 10;
const TOP_COUPLINGS = 5;
const BAR_WIDTH = 10;

const scoreBar = (score: number): string => {
  const filled = Math.round(score * BAR_WIDTH);
  return "█".repeat(filled) + "░".repeat(BAR_WIDTH - filled);
};

const hotspotLines = (
  files: ReadonlyArray<FileStats>,
  style: Style,
): ReadonlyArray<string> =>
  renderTable(
    [
      { header: "rank", align: "right" },
      { header: "score", align: "left" },
      { header: "revisions", align: "right" },
      { header: "complexity", align: "right" },
      { header: "path", align: "left" },
    ],
    files.slice(0, TOP_HOTSPOTS).map((file) => [
      plain(`#${file.rank}`),
      {
        text: `${scoreBar(file.score)} ${file.score.toFixed(2)}`,
        paint: (text) => style.heat(file.score, text),
      },
      plain(String(file.revisions)),
      plain(String(file.complexity.total)),
      plain(escapeForTerminal(file.path)),
    ]),
    style,
  );

const couplingLines = (
  couplings: ReadonlyArray<Coupling>,
  files: ReadonlyArray<FileStats>,
  style: Style,
): ReadonlyArray<string> => {
  const revisions = new Map(files.map((file) => [file.path, file.revisions]));
  const coChange = (coupling: Coupling, from: string): string => {
    const total = revisions.get(from);
    if (total === undefined) {
      throw new Error(
        `Coupled file ${escapeForTerminal(from)} is missing from the report's files; render an untruncated report.`,
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
      { header: "files", align: "left" },
    ],
    couplings
      .filter((coupling) => !coupling.testPair)
      .slice(0, TOP_COUPLINGS)
      .map((coupling) => [
        plain(percent(coupling.degree)),
        plain(String(coupling.sharedCommits)),
        plain(String(coupling.distance)),
        plain(coChange(coupling, coupling.a)),
        plain(coChange(coupling, coupling.b)),
        plain(
          `${escapeForTerminal(coupling.a)} <-> ${escapeForTerminal(coupling.b)}`,
        ),
      ]),
    style,
  );
};

/**
 * Renders the terminal view of an `analyze` report: the ten hottest files and
 * the five strongest couplings that are not test pairs, each with the
 * co-change probability in both directions (`shared / revisions(side)`). The
 * report must not be cut to `--limit`: test pairs could crowd out every other
 * coupling, and every coupled file must appear in `files`: rendering throws
 * otherwise.
 * The result has no trailing newline.
 */
export const renderAnalysis = (report: Report, style: Style): string => {
  const summary = `${escapeForTerminal(report.repository.name)}  ${day(report.window.since)} to ${day(report.window.until)}  ${report.window.commits} commits, ${report.totals.files} files`;
  const hotspots =
    report.files.length === 0
      ? ["No files in the analysis universe."]
      : hotspotLines(report.files, style);
  const couplings = couplingLines(report.couplings, report.files, style);
  return [
    style.bold(summary),
    "",
    style.bold("Hotspots"),
    ...hotspots,
    "",
    style.bold("Change coupling (test pairs excluded)"),
    ...(couplings.length > 1
      ? couplings
      : ["No change coupling above the thresholds."]),
    "",
    style.dim("Use --html for the treemap or --json for the full report."),
  ].join("\n");
};
