// Owns the human view of `analyze`: top hotspots, top couplings, the weakest modules, one hint.
import type { Coupling, FileStats, Module, Report } from "@codeheat/engine";
import { Order } from "effect";

import { escapeForTerminal } from "../escape.js";
import { day, percent } from "./format.js";
import type { Style } from "./style.js";
import { plain, renderTable } from "./table.js";

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

/**
 * Modules with entry points and enough implementation commits, the highest
 * leakage first; ties go to more commits, then path. This is a ranking of its
 * own over all modules: the report's order is by cohesion. Test-only modules
 * have no interface to judge.
 */
const leakiestModules = (report: Report): ReadonlyArray<Module> =>
  report.modules
    .filter(
      (module) =>
        !module.testOnly &&
        module.leakage !== null &&
        module.implementationCommits >=
          report.thresholds.minImplementationCommits,
    )
    .toSorted(
      (a, b) =>
        (b.leakage ?? 0) - (a.leakage ?? 0) ||
        b.implementationCommits - a.implementationCommits ||
        Order.String(a.path, b.path),
    )
    .slice(0, TOP_MODULES);

/**
 * Renders the terminal view of an `analyze` report: the ten hottest files,
 * the five strongest couplings that are not test pairs, each with the
 * co-change probability in both directions (`shared / revisions(side)`), the
 * five least cohesive modules, and the five modules whose interface changes
 * with their implementation most often. The report must not be cut to
 * `--limit`: test pairs could crowd out every other coupling, and every
 * coupled file must appear in `files`: rendering throws otherwise.
 * The result has no trailing newline.
 */
export const renderAnalysis = (report: Report, style: Style): string => {
  const summary = `${escapeForTerminal(report.repository.name)}  ${day(report.window.since)} to ${day(report.window.until)}  ${report.window.commits} commits, ${report.totals.files} files`;
  const hotspots =
    report.files.length === 0
      ? ["No files in the analysis universe."]
      : hotspotLines(report.files, style);
  const couplings = couplingLines(report.couplings, report.files, style);
  const modules = rankedModules(report);
  const leaky = leakiestModules(report);
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
    style.bold("Least cohesive modules"),
    ...(modules.length > 0
      ? moduleLines(modules, style)
      : [
          `No module has ${report.thresholds.minModuleCommits} or more counted commits.`,
        ]),
    "",
    style.bold("Leakiest interfaces"),
    ...(leaky.length > 0
      ? leakageLines(leaky, style)
      : [
          `No module has entry points and ${report.thresholds.minImplementationCommits} or more implementation commits.`,
        ]),
    "",
    style.dim("Use --html for the treemap or --json for the full report."),
  ].join("\n");
};
