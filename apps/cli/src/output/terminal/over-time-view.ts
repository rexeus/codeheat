// Owns the terminal view of how the design moved over the analysis window:
// the verdict, the modules losing cohesion, the hotspots by age, and the fixes.
import type { FileStats, Module, Analysis } from "@codeheat/engine";

import { escapeForTerminal } from "../escape.js";
import { month, percent } from "./format.js";
import type { Style } from "./style.js";

const TOP_ERODING_MODULES = 3;
const TOP_CHRONIC_HOTSPOTS = 3;
const MS_PER_MONTH = 30.4375 * 24 * 60 * 60 * 1000;
/** Windows between these lengths, in months, are called quarters. */
const QUARTER_MONTHS = { min: 2.5, max: 3.5 };

const plural = (count: number, one: string, many: string): string =>
  `${count} ${count === 1 ? one : many}`;

/** What to call `count` windows of the series: quarters when they are about that long, else by their length. */
const windowNoun = (series: Analysis["series"], count: number): string => {
  const [first] = series;
  const months =
    first === undefined
      ? 3
      : (Date.parse(first.until) - Date.parse(first.since)) / MS_PER_MONTH;
  return months >= QUARTER_MONTHS.min && months <= QUARTER_MONTHS.max
    ? plural(count, "quarter", "quarters")
    : plural(
        count,
        `${Math.round(months)}-month window`,
        `${Math.round(months)}-month windows`,
      );
};

/** A fitted share as a percentage: the report keeps the line's own values, but no share is below 0 % or above 100 %. */
const share = (value: number): string =>
  percent(Math.min(1, Math.max(0, value)));

const TREND_WORDS = {
  eroding:
    "Eroding: the territories the verdict judges keep less and less of their changes inside",
  improving:
    "Improving: the territories the verdict judges keep more and more of their changes inside",
  holding:
    "Holding: no lasting change in how much of their changes the territories the verdict judges keep inside",
} as const;

/** The verdict's trend (`verdict.trend`, the one that lowers its level) as one sentence; `quiet` says since when the series has been quiet. */
const trendLine = (report: Analysis, quiet: string): string => {
  const { verdict, series, thresholds } = report;
  if (verdict.trend !== "unknown") {
    return `${TREND_WORDS[verdict.trend]} over ${windowNoun(series, series.length)}${quiet}.`;
  }
  return verdict.judged.length === 0
    ? `No trend yet: no territory the verdict can judge${quiet}.`
    : `No trend yet: it needs ${thresholds.minVerdictWindows} windows with at least ${thresholds.minWindowChanges} changes, and as many touching a judged territory${quiet}.`;
};

/** The modules' erosion as context, one sentence with the numbers behind it. */
const moduleLine = (
  erosion: NonNullable<Analysis["erosion"]>,
  { series, thresholds }: Analysis,
): ReadonlyArray<string> => {
  if (erosion.verdict === "unknown") {
    return [
      `Modules: no trend yet, ${plural(erosion.windows, "window has", "windows have")} at least ${thresholds.minWindowChanges} changes, and a trend needs ${thresholds.minTrendWindows}.`,
    ];
  }
  const line = erosion.locality;
  if (line === null) {
    return [];
  }
  const moved = {
    eroding: `changes that stay in one module fell from ${share(line.from)} to ${share(line.to)}`,
    improving: `changes that stay in one module rose from ${share(line.from)} to ${share(line.to)}`,
    holding: `no lasting change in the share of changes that stay in one module (${share(line.from)} to ${share(line.to)})`,
  }[erosion.verdict];
  return [
    `Modules: ${moved} over the active period of ${windowNoun(series, erosion.windows)}.`,
  ];
};

/** The verdict's trend, then the modules' erosion as context; nothing without a series. */
const verdictLines = (report: Analysis): ReadonlyArray<string> => {
  const { erosion, thresholds } = report;
  if (erosion === null) {
    return [];
  }
  const quiet =
    erosion.inactiveSince === null
      ? ""
      : ` (quiet since ${month(erosion.inactiveSince)}: fewer than ${thresholds.minWindowChanges} changes a window)`;
  return [trendLine(report, quiet), ...moduleLine(erosion, report)];
};

/** Modules still changing whose cohesion fell by more than chance explains (their `verdict` is `eroding`), most eroded first. */
const erodingModules = ({
  modules,
}: Analysis): ReadonlyArray<
  Module & { erosion: NonNullable<Module["erosion"]> }
> =>
  modules
    .flatMap((module) =>
      module.erosion !== null &&
      module.erosion.recent &&
      module.erosion.verdict === "eroding"
        ? [{ ...module, erosion: module.erosion }]
        : [],
    )
    .toSorted(
      (a, b) =>
        b.erosion.from - b.erosion.to - (a.erosion.from - a.erosion.to) ||
        a.path.localeCompare(b.path),
    )
    .slice(0, TOP_ERODING_MODULES);

const erodingLines = (report: Analysis): ReadonlyArray<string> =>
  erodingModules(report).map(
    ({ path, erosion }) =>
      `  ${escapeForTerminal(path)}: cohesion ${share(erosion.from)} to ${share(erosion.to)} over ${windowNoun(report.series, erosion.windows)}`,
  );

const filesWithHeat = (
  files: ReadonlyArray<FileStats>,
  kind: "chronic" | "acute",
) => files.filter((file) => file.heat?.kind === kind);

const hotspotLines = (report: Analysis): ReadonlyArray<string> => {
  const chronic = filesWithHeat(report.files, "chronic");
  const acute = filesWithHeat(report.files, "acute");
  if (chronic.length + acute.length === 0) {
    return [];
  }
  return [
    `Hotspots by age: ${plural(chronic.length, "chronic file", "chronic files")} (hot in at least half of its windows, so a design problem) and ${plural(acute.length, "acute file", "acute files")} (hot only lately, so current work).`,
    ...chronic
      .slice(0, TOP_CHRONIC_HOTSPOTS)
      .map(
        (file) =>
          `  #${file.rank} ${escapeForTerminal(file.path)}: hot in ${file.heat?.hotWindows ?? 0} of ${file.heat?.windows ?? 0} windows`,
      ),
  ];
};

/** The share of fixes, or that it is unknown; nothing without counted changes. */
const fixLines = ({
  fixDensity,
  modules,
  thresholds,
}: Analysis): ReadonlyArray<string> => {
  if (fixDensity.changes === 0) {
    return [];
  }
  if (!fixDensity.known || fixDensity.share === null) {
    return [
      `Fixes: unknown, as only ${percent(fixDensity.conventional)} of the commit subjects match a fix rule or a Conventional Commits type.`,
    ];
  }
  const [worst] = modules
    .filter(
      ({ fixDensity: fixes, commits }) =>
        fixes !== null && commits >= thresholds.minModuleCommits,
    )
    .toSorted(
      (a, b) =>
        (b.fixDensity?.share ?? 0) - (a.fixDensity?.share ?? 0) ||
        a.path.localeCompare(b.path),
    );
  const worstFixes = worst?.fixDensity;
  const where =
    worst === undefined ||
    worstFixes === undefined ||
    worstFixes === null ||
    worstFixes.fixes === 0
      ? ""
      : `; most in ${escapeForTerminal(worst.path)} (${percent(worstFixes.share)}, ${worstFixes.spanning} of its ${plural(worstFixes.fixes, "fix", "fixes")} also touched another module)`;
  return [
    `Fixes: ${percent(fixDensity.share)} of ${plural(fixDensity.changes, "change", "changes")} fix something${where}.`,
  ];
};

/**
 * The "Over time" section, headed with where the series starts (it can start
 * before the analysis window: see `Analysis.seriesSince`): whether the design is holding or eroding (the verdict's trend, with the modules' erosion as context), the
 * three modules whose cohesion fell most while still changing, how many
 * hotspots are chronic or acute, and how many changes are fixes. Parts the
 * report has no data for are left out, and so is the whole section when none
 * has. Ends with an empty line when it is not empty.
 */
export const overTimeSection = (
  report: Analysis,
  style: Style,
): ReadonlyArray<string> => {
  const lines = [
    verdictLines(report),
    erodingLines(report),
    hotspotLines(report),
    fixLines(report),
  ].flat();
  const span =
    report.seriesSince === null ? "" : ` (since ${month(report.seriesSince)})`;
  return lines.length === 0
    ? []
    : [style.bold(`Over time${span}`), ...lines, ""];
};

/** What a file's heat says on one line: nothing for a file that is neither chronic nor acute. */
export const heatLines = ({
  heat,
}: Pick<FileStats, "heat">): ReadonlyArray<string> => {
  if (heat === null) {
    return [];
  }
  return heat.kind === "chronic"
    ? [
        `chronic hotspot: hot in ${heat.hotWindows} of ${heat.windows} windows, so a design problem rather than current work`,
      ]
    : [
        `acute hotspot: hot in ${heat.hotWindows} of ${heat.windows} windows, only lately, so current work`,
      ];
};
