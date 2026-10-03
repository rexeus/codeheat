// Owns the terminal view of how the design moved over the analysis window:
// the verdict, the modules losing cohesion, the hotspots by age, and the fixes.
import type { FileStats, Module, Report } from "@codeheat/engine";

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
const windowNoun = (series: Report["series"], count: number): string => {
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

const VERDICT_LABELS = {
  eroding: "Eroding",
  improving: "Improving",
  holding: "Holding",
} as const;

/** The verdict on the whole repository as one sentence with the numbers behind it. */
const verdictLine = (report: Report): string | undefined => {
  const { erosion, series, thresholds } = report;
  if (erosion === null) {
    return undefined;
  }
  const active = windowNoun(series, erosion.windows);
  const line = erosion.locality;
  const moved =
    line === null
      ? ""
      : `changes that stay in one module went from ${percent(line.from)} to ${percent(line.to)} over the active period of ${active}`;
  const quiet =
    erosion.inactiveSince === null
      ? ""
      : ` (quiet since ${month(erosion.inactiveSince)}: fewer than ${thresholds.minWindowChanges} changes a window)`;
  if (erosion.verdict === "unknown") {
    return `No verdict yet: ${plural(erosion.windows, "window has", "windows have")} at least ${thresholds.minWindowChanges} changes, and a trend needs ${thresholds.minTrendWindows}${quiet}.`;
  }
  return `${VERDICT_LABELS[erosion.verdict]}: ${moved}${quiet}.`;
};

/** Modules still changing whose cohesion fell by at least the shift that counts, most eroded first. */
const erodingModules = ({
  modules,
  thresholds,
}: Report): ReadonlyArray<
  Module & { erosion: NonNullable<Module["erosion"]> }
> =>
  modules
    .flatMap((module) =>
      module.erosion !== null &&
      module.erosion.recent &&
      module.erosion.from - module.erosion.to >= thresholds.minErosionShift
        ? [{ ...module, erosion: module.erosion }]
        : [],
    )
    .toSorted(
      (a, b) =>
        b.erosion.from - b.erosion.to - (a.erosion.from - a.erosion.to) ||
        a.path.localeCompare(b.path),
    )
    .slice(0, TOP_ERODING_MODULES);

const erodingLines = (report: Report): ReadonlyArray<string> =>
  erodingModules(report).map(
    ({ path, erosion }) =>
      `  ${escapeForTerminal(path)}: cohesion ${percent(erosion.from)} to ${percent(erosion.to)} over ${windowNoun(report.series, erosion.windows)}`,
  );

const filesWithHeat = (
  files: ReadonlyArray<FileStats>,
  kind: "chronic" | "acute",
) => files.filter((file) => file.heat?.kind === kind);

const hotspotLines = (report: Report): ReadonlyArray<string> => {
  const chronic = filesWithHeat(report.files, "chronic");
  const acute = filesWithHeat(report.files, "acute");
  if (chronic.length + acute.length === 0) {
    return [];
  }
  return [
    `Hotspots by age: ${plural(chronic.length, "chronic file", "chronic files")} (hot in most windows, so a design problem) and ${plural(acute.length, "acute file", "acute files")} (hot only lately, so current work).`,
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
}: Report): ReadonlyArray<string> => {
  if (fixDensity.changes === 0) {
    return [];
  }
  if (!fixDensity.known || fixDensity.share === null) {
    return [
      `Fixes: unknown, as only ${percent(fixDensity.conventional)} of the commit subjects follow a convention.`,
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
 * The "Over time" section: whether the design is holding or eroding, the
 * three modules whose cohesion fell most while still changing, how many
 * hotspots are chronic or acute, and how many changes are fixes. Parts the
 * report has no data for are left out, and so is the whole section when none
 * has. Ends with an empty line when it is not empty.
 */
export const overTimeSection = (
  report: Report,
  style: Style,
): ReadonlyArray<string> => {
  const lines = [
    verdictLine(report) ?? [],
    erodingLines(report),
    hotspotLines(report),
    fixLines(report),
  ].flat();
  return lines.length === 0 ? [] : [style.bold("Over time"), ...lines, ""];
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
