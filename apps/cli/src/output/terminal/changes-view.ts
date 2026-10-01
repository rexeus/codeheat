// Owns the "Biggest changes" part of the terminal view: what warmed up and which
// modules moved in cohesion between the previous window and the latest one.
import type { FileStats, Report } from "@codeheat/engine";

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
 * previous window are not warming but new (see `newlyActiveFiles`), and a test
 * file moving says little about the code. The report lists files by rank, so
 * ties keep rank order.
 */
const warmingFiles = (files: ReadonlyArray<FileStats>) =>
  files
    .flatMap((file) =>
      file.trend !== null &&
      !file.trend.newlyActive &&
      file.trend.scoreDelta > 0 &&
      !file.test
        ? [{ file, trend: file.trend }]
        : [],
    )
    .toSorted((a, b) => b.trend.scoreDelta - a.trend.scoreDelta)
    .slice(0, TOP_FILES);

/** The highest-ranked source files that had no revision in the previous window. */
const newlyActiveFiles = (files: ReadonlyArray<FileStats>) =>
  files
    .filter((file) => file.trend?.newlyActive === true && !file.test)
    .slice(0, TOP_NEWLY_ACTIVE);

/** The modules whose cohesion moved most in either direction, among the ranked ones (enough commits, not test-only). */
const movingModules = (report: Report) =>
  report.modules
    .flatMap((module) =>
      module.trend !== null &&
      module.trend.cohesionDelta !== 0 &&
      module.commits >= report.thresholds.minModuleCommits &&
      !module.testOnly
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

const moduleLines = (report: Report, style: Style) => {
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

/**
 * The lines of the "Biggest changes" section: the five source files active in
 * both windows that got hotter most, the three highest-ranked source files that
 * became active, and the five modules whose cohesion moved most, each against the
 * previous window. Empty without `report.comparison`.
 */
export const changeLines = (
  report: Report,
  style: Style,
): ReadonlyArray<string> => {
  const { comparison } = report;
  if (comparison === null) {
    return [];
  }
  return [
    style.bold(
      `Biggest changes against ${day(comparison.previousSince)} to ${day(comparison.previousUntil)}`,
    ),
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
