// Owns the terminal view of module depth: the modules with the least implementation behind each export.
import type { Module, Report } from "@codeheat/engine";
import { Order } from "effect";

import { escapeForTerminal } from "../escape.js";
import { twoDecimals } from "./format.js";
import type { Style } from "./style.js";
import { plain, renderTable } from "./table.js";

const TOP_MODULES = 5;

type Depth = NonNullable<Module["depth"]>;
type Measured = { readonly path: string; readonly depth: Depth };

/** Shallowest first: fewest implementation lines per export, then the wider interface, then `path`. */
const byShallowness = (a: Measured, b: Measured): number =>
  a.depth.linesPerExport - b.depth.linesPerExport ||
  b.depth.exports - a.depth.exports ||
  Order.String(a.path, b.path);

/**
 * The five shallowest ranked modules (enough counted commits, not test-only;
 * see `Report.modules`) whose depth is known.
 */
const shallowestModules = (report: Report): ReadonlyArray<Measured> =>
  report.modules
    .filter(
      (module) =>
        module.commits >= report.thresholds.minModuleCommits &&
        !module.testOnly,
    )
    .flatMap(({ path, depth }) => (depth === null ? [] : [{ path, depth }]))
    .toSorted(byShallowness)
    .slice(0, TOP_MODULES);

/** How a module's depth reads on one line: its interface, its implementation, and the ratio. */
export const describeDepth = (depth: Depth): string =>
  `${depth.exports} exports over ${depth.implementationLines} lines, ${twoDecimals(depth.linesPerExport)} lines per export`;

/**
 * The lines of the "Shallowest modules" section: a table, or none when no
 * ranked module has a depth (a repository without TypeScript or JavaScript
 * entry points, or without the parser, has nothing to rank).
 */
export const shallowestLines = (
  report: Report,
  style: Style,
): ReadonlyArray<string> => {
  const modules = shallowestModules(report);
  return modules.length === 0
    ? []
    : renderTable(
        [
          { header: "lines/export", align: "right" },
          { header: "exports", align: "right" },
          { header: "lines", align: "right" },
          { header: "module", align: "left" },
        ],
        modules.map(({ depth, path }) => [
          plain(twoDecimals(depth.linesPerExport)),
          plain(String(depth.exports)),
          plain(String(depth.implementationLines)),
          plain(escapeForTerminal(path)),
        ]),
        style,
      );
};
