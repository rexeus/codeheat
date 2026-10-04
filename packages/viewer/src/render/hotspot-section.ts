import type { FileStats } from "@codeheat/engine";

import { overviewHotspots } from "../hotspots/overview-hotspots.js";
import { h, section } from "./dom.js";

/** The overview's list of top hotspots, which remembers whether the reader included test code. */
export type HotspotSection = {
  /** A fresh section showing the list as the reader last chose it. */
  readonly element: () => HTMLElement;
};

/**
 * Builds the "Top hotspots" section of the overview from `hottestFirst`, with
 * `row` drawing one file. Production code is listed until the reader ticks
 * "Include test code"; the choice stays when the overview is shown again.
 */
export const createHotspotSection = (
  hottestFirst: readonly FileStats[],
  row: (file: FileStats) => HTMLElement,
): HotspotSection => {
  let includeTests = false;
  return {
    element: () => {
      const list = h("ul", "list");
      const paint = (): void => {
        list.replaceChildren(
          ...overviewHotspots(hottestFirst, includeTests).files.map(row),
        );
      };
      paint();
      const { includesTests, toggleable } = overviewHotspots(
        hottestFirst,
        includeTests,
      );
      const input = h("input", "");
      input.type = "checkbox";
      input.checked = includeTests;
      input.addEventListener("change", () => {
        includeTests = input.checked;
        paint();
      });
      const element = section(
        "Top hotspots",
        ...(includesTests && !toggleable
          ? [
              h(
                "p",
                "hint hotspot-note",
                "This report has no production code, so the list shows test code.",
              ),
            ]
          : []),
        ...(toggleable
          ? [
              h(
                "label",
                "hotspot-toggle",
                input,
                h("span", "", "Include test code"),
              ),
            ]
          : []),
        list,
      );
      element.dataset["overview"] = "hotspots";
      return element;
    },
  };
};
