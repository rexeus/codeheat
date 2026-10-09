// Owns the human view of `analyze`: the answer, top hotspots, couplings, the weakest and shallowest modules, biggest changes, one hint.
import type { FileStats, Module, Analysis } from "@codeheat/engine";

import { escapeForTerminal } from "../escape.js";
import { changeLines } from "./changes-view.js";
import { partnerName, ubiquitousLines } from "./contract-view.js";
import { copyLines } from "./copies-view.js";
import { shallowestLines } from "./depth-view.js";
import {
  cliqueSection,
  couplingLines,
  distantSection,
} from "./distant-view.js";
import { entryPointLines } from "./entry-points-view.js";
import { percent } from "./format.js";
import { leakySection } from "./leakage-view.js";
import { overTimeSection } from "./over-time-view.js";
import { stabilitySections } from "./stability-view.js";
import type { Style } from "./style.js";
import { summaryLines } from "./summary-view.js";
import { plain, renderTable } from "./table.js";
import { territoryLines } from "./territory-view.js";

const TOP_HOTSPOTS = 10;
const TOP_MODULES = 5;
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

const moduleLines = (
  modules: ReadonlyArray<Module>,
  style: Style,
): ReadonlyArray<string> =>
  renderTable(
    [
      { header: "cohesion", align: "right" },
      { header: "changes", align: "right" },
      { header: "module", align: "left" },
      { header: "changes most with", align: "left" },
    ],
    modules.map((module) => {
      const [partner] = module.partners;
      return [
        plain(percent(module.cohesion ?? 0)),
        plain(String(module.commits)),
        plain(escapeForTerminal(module.path)),
        plain(
          partner === undefined
            ? ""
            : `${partnerName(partner)} (${partner.sharedCommits})`,
        ),
      ];
    }),
    style,
  );

/** The first modules of the report's ranking: enough commits to say something. The report already lists them least cohesive first. */
const rankedModules = (report: Analysis): ReadonlyArray<Module> =>
  report.modules
    .filter((module) => module.commits >= report.thresholds.minModuleCommits)
    .slice(0, TOP_MODULES);

/**
 * Renders the terminal view of an `analyze` report: the answer and the
 * summary line (see `summaryLines`), the day of the repository's
 * newest commit for a window without counted changes, how far a change spreads
 * (change radius and propagation cost, each left out when the report has
 * none), how many territories the recommended detail has, where to start (the
 * ranked entry points, left out when there are none), the ten hottest files, how the design moved over time (the verdict,
 * the modules losing cohesion, hotspots by age, and the share of fixes; each
 * part is left out when the report has no data for it),
 * the five best ranked distant couplings and a line per clique of modules
 * that change together (each section is left out when there is none),
 * the five strongest couplings that are no pair of two contract files, each with the co-change probability in both directions
 * (`shared / changes(side)`) and a contract file marked `(contract)`, the
 * five copy families with the most changes touching every copy (the section is left out when there is none), the five least cohesive
 * modules, the first five modules with a leaky interface,
 * the five shallowest ranked modules (fewest implementation lines per exported
 * name; the section is left out when none has a depth), the five most
 * unstable interfaces and the three imports that point from a stable module
 * to a volatile one (left out when there are none), and, when the report
 * compares two windows, the biggest changes. The report
 * must not be cut to `--limit`: contract pairs could crowd out every other
 * coupling, and every coupled file must appear in `files` or `contracts`:
 * rendering throws otherwise.
 * The result has no trailing newline.
 */
export const renderAnalysis = (report: Analysis, style: Style): string => {
  const hotspots =
    report.files.length === 0
      ? ["No files in the analysis universe."]
      : hotspotLines(report.files, style);
  const couplings = couplingLines(
    report.couplings,
    report.files,
    report.contracts,
    style,
  );
  const copies = copyLines(report, style);
  const modules = rankedModules(report);
  const shallow = shallowestLines(report, style);
  return [
    ...summaryLines(report, style),
    ...territoryLines(report),
    "",
    ...entryPointLines(report, style),
    style.bold("Hotspots"),
    ...hotspots,
    "",
    ...overTimeSection(report, style),
    ...distantSection(report, style),
    ...cliqueSection(report, style),
    style.bold("Change coupling (contract pairs excluded)"),
    ...(couplings.length > 1
      ? couplings
      : ["No change coupling above the thresholds."]),
    ...ubiquitousLines(report).map((line) => style.dim(line)),
    "",
    ...(copies.length === 0
      ? []
      : [
          style.bold("Copies (similar files that change in lockstep)"),
          ...copies,
          "",
        ]),
    style.bold("Least cohesive modules"),
    ...(modules.length > 0
      ? moduleLines(modules, style)
      : [
          `No module has ${report.thresholds.minModuleCommits} or more counted changes.`,
        ]),
    "",
    ...leakySection(report, style),
    ...(shallow.length === 0
      ? []
      : [style.bold("Shallowest modules"), ...shallow, ""]),
    ...stabilitySections(report, style),
    ...changeLines(report, style),
    style.dim("Use --html for the treemap or --json for the full report."),
  ].join("\n");
};
