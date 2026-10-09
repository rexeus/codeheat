// Owns the "Biggest changes" part of the terminal view: what warmed up and which
// modules moved in cohesion between the previous window and the latest one.
import type { FileStats, Analysis } from "@codeheat/engine";

import { escapeForTerminal } from "../escape.js";
import { day, percent } from "./format.js";
import type { Style } from "./style.js";
import { plain, renderTable } from "./table.js";

const TOP_FILES = 5;
const TOP_NEWLY_ACTIVE = 3;
const TOP_MODULES = 5;

const signed = (text: string, value: number): string =>
  value > 0 ? `+${text}` : text;

const scoreChange = (delta: number): string => signed(delta.toFixed(2), delta);

const pointChange = (delta: number): string => {
  const points = Math.round(delta * 100);
  return `${signed(String(points), points)} pts`;
};

/**
 * The source files whose score rose most. Files without revisions in the
 * previous window are not warming but new (see `newlyActiveFiles`). The report
 * lists files by rank, so ties keep rank order.
 */
const warmingFiles = (files: ReadonlyArray<FileStats>) =>
  files
    .flatMap((file) =>
      file.trend !== null &&
      !file.trend.newlyActive &&
      file.trend.scoreDelta > 0
        ? [{ file, trend: file.trend }]
        : [],
    )
    .toSorted((a, b) => b.trend.scoreDelta - a.trend.scoreDelta)
    .slice(0, TOP_FILES);

/** The highest-ranked source files that had no revision in the previous window. */
const newlyActiveFiles = (files: ReadonlyArray<FileStats>) =>
  files
    .filter((file) => file.trend?.newlyActive === true)
    .slice(0, TOP_NEWLY_ACTIVE);

/** The modules whose cohesion moved most in either direction, among the ranked ones (enough commits). */
const movingModules = (report: Analysis) =>
  report.modules
    .flatMap((module) =>
      module.trend !== null &&
      module.trend.cohesionDelta !== 0 &&
      module.commits >= report.thresholds.minModuleCommits
        ? [{ module, trend: module.trend }]
        : [],
    )
    .toSorted(
      (a, b) =>
        Math.abs(b.trend.cohesionDelta) - Math.abs(a.trend.cohesionDelta),
    )
    .slice(0, TOP_MODULES);

const fileLines = (files: ReadonlyArray<FileStats>, style: Style) => {
  const warming = warmingFiles(files);
  return warming.length === 0
    ? ["No file got hotter."]
    : renderTable(
        [
          { header: "change", align: "right" },
          { header: "score", align: "right" },
          { header: "before", align: "right" },
          { header: "path", align: "left" },
        ],
        warming.map(({ file, trend }) => [
          plain(scoreChange(trend.scoreDelta)),
          plain(file.score.toFixed(2)),
          plain(trend.previousScore.toFixed(2)),
          plain(escapeForTerminal(file.path)),
        ]),
        style,
      );
};

const newlyActiveLines = (files: ReadonlyArray<FileStats>, style: Style) => {
  const fresh = newlyActiveFiles(files);
  return fresh.length === 0
    ? ["No source file became active."]
    : renderTable(
        [
          { header: "score", align: "right" },
          { header: "path", align: "left" },
        ],
        fresh.map((file) => [
          plain(file.score.toFixed(2)),
          plain(escapeForTerminal(file.path)),
        ]),
        style,
      );
};

const moduleLines = (report: Analysis, style: Style) => {
  const moving = movingModules(report);
  return moving.length === 0
    ? ["No module changed in cohesion."]
    : renderTable(
        [
          { header: "change", align: "right" },
          { header: "cohesion", align: "right" },
          { header: "before", align: "right" },
          { header: "module", align: "left" },
        ],
        moving.map(({ module, trend }) => [
          plain(pointChange(trend.cohesionDelta)),
          plain(percent(module.cohesion ?? 0)),
          plain(percent(trend.previousCohesion)),
          plain(escapeForTerminal(module.path)),
        ]),
        style,
      );
};

const TRUNCATED_NOTE =
  "Note: the previous window reaches back past the oldest commit of this repository (or of its shallow clone), so it covers less history than the latest one.";

/** What a window without real changes holds: nothing, or only mechanical commits. */
const emptyWindow = (commits: number): string =>
  commits === 0 ? "has no commits" : "has only mechanical commits";

/** Why there is nothing to compare, or `undefined` when both windows have real changes. */
const noDataReason = ({ comparison, window }: Analysis): string | undefined => {
  if (comparison?.previousRealCommits === 0) {
    return `No comparison data: the previous window ${emptyWindow(comparison.previousCommits)}.`;
  }
  return window.realCommits === 0
    ? `No comparison data: the latest window ${emptyWindow(window.commits)}.`
    : undefined;
};

/**
 * The lines of the "Biggest changes" section: the five source files active in
 * both windows that got hotter most, the three highest-ranked source files that
 * became active, and the five modules whose cohesion moved most, each against
 * the previous window. A window without commits has nothing to compare, which
 * the section says instead of listing nothing; a previous window cut off at the
 * start of the history carries a note. Empty without `report.comparison`.
 */
export const changeLines = (
  report: Analysis,
  style: Style,
): ReadonlyArray<string> => {
  const { comparison } = report;
  if (comparison === null) {
    return [];
  }
  const heading = style.bold(
    `Biggest changes against ${day(comparison.previousSince)} to ${day(comparison.previousUntil)}`,
  );
  const truncated = comparison.previousTruncated ? [TRUNCATED_NOTE] : [];
  const reason = noDataReason(report);
  if (reason !== undefined) {
    return [heading, reason, ...truncated, ""];
  }
  return [
    heading,
    ...truncated,
    style.dim(
      "Warming files (active in both windows; scores are normalized per window)",
    ),
    ...fileLines(report.files, style),
    "",
    style.dim("Newly active (no revisions in the previous window)"),
    ...newlyActiveLines(report.files, style),
    "",
    style.dim("Cohesion changes"),
    ...moduleLines(report, style),
    "",
  ];
};
