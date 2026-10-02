// Owns the human view of `analyze`: top hotspots, couplings, the weakest and shallowest modules, biggest changes, one hint.
import type { Coupling, FileStats, Module, Report } from "@codeheat/engine";

import { escapeForTerminal } from "../escape.js";
import { changeLines } from "./changes-view.js";
import { contractNote, coupledPath, ubiquitousLines } from "./contract-view.js";
import { shallowestLines } from "./depth-view.js";
import { day, percent } from "./format.js";
import type { Style } from "./style.js";
import { plain, renderTable } from "./table.js";
import type { Cell } from "./table.js";

const TOP_HOTSPOTS = 10;
const TOP_COUPLINGS = 5;
const TOP_MODULES = 5;
const SHOWN_ENTRY_POINTS = 2;
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

/** Which of the two files imports the other; no import at all is hidden coupling, which stands out. */
const importsCell = ({ imports }: Coupling, style: Style): Cell =>
  imports === "none"
    ? { text: "hidden", paint: style.bold }
    : plain(imports ?? "-");

const couplingLines = (
  couplings: ReadonlyArray<Coupling>,
  files: ReadonlyArray<FileStats>,
  contracts: Report["contracts"],
  style: Style,
): ReadonlyArray<string> => {
  const revisions = new Map(
    [...files, ...contracts].map((file) => [file.path, file.revisions]),
  );
  const coChange = (coupling: Coupling, from: string): string => {
    const total = revisions.get(from);
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
      .filter((coupling) => !coupling.testPair)
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

const moduleLines = (
  modules: ReadonlyArray<Module>,
  style: Style,
): ReadonlyArray<string> =>
  renderTable(
    [
      { header: "cohesion", align: "right" },
      { header: "commits", align: "right" },
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
            : `${escapeForTerminal(partner.path)} (${partner.sharedCommits})`,
        ),
      ];
    }),
    style,
  );

/** The first modules of the report's ranking: enough commits to say something, not test-only. The report already lists them least cohesive first. */
const rankedModules = (report: Report): ReadonlyArray<Module> =>
  report.modules
    .filter(
      (module) =>
        module.commits >= report.thresholds.minModuleCommits &&
        !module.testOnly,
    )
    .slice(0, TOP_MODULES);

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
      { header: "commits", align: "right" },
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

/**
 * Renders the terminal view of an `analyze` report: the ten hottest files,
 * the five strongest couplings that are not test pairs, each with the
 * co-change probability in both directions (`shared / revisions(side)`), the
 * five least cohesive modules, the first five modules with a leaky interface,
 * the five shallowest ranked modules (fewest implementation lines per exported
 * name; the section is left out when none has a depth), and, when the report compares two windows, the biggest changes. The report
 * must not be cut to `--limit`: test pairs could crowd out every other
 * coupling, and every coupled file must appear in `files` or `contracts`:
 * rendering throws otherwise.
 * The result has no trailing newline.
 */
export const renderAnalysis = (report: Report, style: Style): string => {
  const summary = `${escapeForTerminal(report.repository.name)}  ${day(report.window.since)} to ${day(report.window.until)}  ${report.window.commits} commits, ${report.totals.files} files${contractNote(report)}`;
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
  const modules = rankedModules(report);
  const leaky = leakyModules(report);
  const shallow = shallowestLines(report, style);
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
    ...ubiquitousLines(report).map((line) => style.dim(line)),
    "",
    style.bold("Least cohesive modules"),
    ...(modules.length > 0
      ? moduleLines(modules, style)
      : [
          `No module has ${report.thresholds.minModuleCommits} or more counted commits.`,
        ]),
    "",
    style.bold("Leaky interfaces"),
    ...(leaky.length > 0
      ? leakageLines(leaky, style)
      : ["No module has a leaky interface."]),
    "",
    ...(shallow.length === 0
      ? []
      : [style.bold("Shallowest modules"), ...shallow, ""]),
    ...changeLines(report, style),
    style.dim("Use --html for the treemap or --json for the full report."),
  ].join("\n");
};
