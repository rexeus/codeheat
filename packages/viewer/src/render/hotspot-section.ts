import type { FileStats } from "@codeheat/engine";

import { overviewHotspots } from "../hotspots/overview-hotspots.js";
import { h, section } from "./dom.js";

/** The overview's list of top hotspots. */
export type HotspotSection = {
  /** A fresh section showing the list. */
  readonly element: () => HTMLElement;
};

/**
 * Builds the "Top hotspots" section of the overview from `hottestFirst`, with
 * `row` drawing one file.
 */
export const createHotspotSection = (
  hottestFirst: readonly FileStats[],
  row: (file: FileStats) => HTMLElement,
): HotspotSection => ({
  element: () => {
    const element = section(
      "Top hotspots",
      h(
        "ul",
        "list",
        ...overviewHotspots(hottestFirst).map((file) => row(file)),
      ),
    );
    element.dataset["overview"] = "hotspots";
    return element;
  },
});
