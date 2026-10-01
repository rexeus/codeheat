import type { Module } from "@codeheat/engine";

import { cohesionStep } from "../color/cohesion-scale.js";
import { leastCohesive } from "../modules/least-cohesive.js";
import { h, pathLabel, section } from "./dom.js";
import { formatCount, formatPercent, formatPointChange } from "./format.js";

const cohesionSwatch = (cohesion: number | null): HTMLElement => {
  const element = h("span", "swatch");
  element.dataset["cohesion"] = String(cohesionStep(cohesion));
  return element;
};

const partnerModulesList = (module: Module): HTMLElement =>
  h(
    "ul",
    "list module-partners",
    ...module.partners.map((partner) =>
      h(
        "li",
        "module-partner",
        pathLabel(partner.path),
        h(
          "span",
          "muted",
          `${formatCount(partner.sharedCommits)} shared commits`,
        ),
      ),
    ),
  );

const cohesionLine = ({
  cohesion,
  commits,
  localCommits,
  trend,
}: Module): HTMLElement =>
  cohesion === null
    ? h("p", "hint", "No counted commit touched this module in the window.")
    : h(
        "div",
        "score-line",
        cohesionSwatch(cohesion),
        h("strong", "score", formatPercent(cohesion)),
        h(
          "span",
          "score-meta",
          h("span", "", "of its changes stay inside"),
          h(
            "span",
            "",
            `${formatCount(localCommits)} of ${formatCount(commits)} commits`,
          ),
          ...(trend === null
            ? []
            : [
                h(
                  "span",
                  "",
                  `${formatPointChange(trend.cohesionDelta)} since the previous window (was ${formatPercent(trend.previousCohesion)})`,
                ),
              ]),
        ),
      );

/** Entry points listed before the rest collapse into a count. */
const SHOWN_ENTRY_POINTS = 5;

const leakageLine = (module: Module): HTMLElement =>
  module.leakage === null
    ? h("p", "hint", "No implementation commit touched this module.")
    : h(
        "div",
        "score-line",
        h("strong", "score", formatPercent(module.leakage)),
        h(
          "span",
          "score-meta",
          h("span", "", "of implementation commits also change it"),
          h(
            "span",
            "",
            `${formatCount(module.implementationCommits)} implementation commits`,
          ),
        ),
        ...(module.leakyInterface ? [h("span", "badge", "leaky")] : []),
      );

const entryPointList = (entryPoints: readonly string[]): HTMLElement =>
  h(
    "ul",
    "list module-partners",
    ...entryPoints
      .slice(0, SHOWN_ENTRY_POINTS)
      .map((path) => h("li", "module-partner", pathLabel(path))),
    ...(entryPoints.length > SHOWN_ENTRY_POINTS
      ? [
          h(
            "li",
            "muted",
            `and ${formatCount(entryPoints.length - SHOWN_ENTRY_POINTS)} more`,
          ),
        ]
      : []),
  );

/** The module's entry points and how often its implementation commits change them too; nothing without entry points. */
const interfaceSection = (module: Module): HTMLElement[] =>
  module.entryPoints.length === 0
    ? []
    : [
        section(
          "Interface",
          leakageLine(module),
          entryPointList(module.entryPoints),
        ),
      ];

/**
 * The panel sections that place a selected file in its module: the module,
 * how many of its changes stay inside, its interface, and the modules it
 * changes with. Nothing when the report does not list the module.
 */
export const fileModuleSection = (module: Module | undefined): HTMLElement[] =>
  module === undefined
    ? []
    : [
        section(
          "Module",
          h(
            "p",
            "module-name",
            pathLabel(module.path),
            h("span", "badge", module.kind),
          ),
          cohesionLine(module),
        ),
        ...interfaceSection(module),
        ...(module.partners.length === 0
          ? []
          : [
              section(
                "Changes together with modules",
                partnerModulesList(module),
              ),
            ]),
      ];

const leastCohesiveRow = (module: Module): HTMLElement =>
  h(
    "li",
    "module-row",
    cohesionSwatch(module.cohesion),
    h(
      "span",
      "partner-body",
      pathLabel(module.path),
      h(
        "span",
        "partner-meta",
        h("span", "", `${formatCount(module.commits)} commits`),
        ...(module.partners[0] === undefined
          ? []
          : [h("span", "", `most with ${module.partners[0].path}`)]),
      ),
    ),
    h("span", "score-chip", formatPercent(module.cohesion ?? 0)),
  );

/**
 * The overview's five least cohesive modules among those with at least
 * `minModuleCommits` counted commits, or a hint when none qualifies.
 */
export const leastCohesiveSection = (
  modules: readonly Module[],
  minModuleCommits: number,
): HTMLElement => {
  const rows = leastCohesive(modules, minModuleCommits).map((module) =>
    leastCohesiveRow(module),
  );
  const element = section(
    "Least cohesive modules",
    rows.length === 0
      ? h(
          "p",
          "hint",
          `No module has ${formatCount(minModuleCommits)} or more counted commits yet.`,
        )
      : h("ul", "list", ...rows),
  );
  element.dataset["overview"] = "modules";
  return element;
};
