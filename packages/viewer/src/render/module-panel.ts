import type { Module } from "@codeheat/engine";

import { cohesionStep } from "../color/cohesion-scale.js";
import { leastCohesive } from "../modules/least-cohesive.js";
import { h, pathLabel, section } from "./dom.js";
import { formatCount, formatPercent } from "./format.js";

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
        ),
      );

/**
 * The panel sections that place a selected file in its module: the module,
 * how many of its changes stay inside, and the modules it changes with.
 * Nothing when the report does not list the module.
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
