import type { FileStats } from "@codeheat/engine";

import type { HeroData } from "../hero/hero-data.js";
import { mountHero } from "../hero/mount-hero.js";
import { mountStart } from "../where-to-start/mount-start.js";
import { byId } from "./dom.js";

/**
 * Renders the hero and "Where to start" from `design`. A file a card links to
 * is selected in the map, which scrolls into view; a file the report does not
 * list (after `--limit`) is not offered as a link.
 */
export const mountDesignFit = (
  design: HeroData,
  files: readonly FileStats[],
  select: (path: string) => void,
): void => {
  mountHero(design);
  mountStart(design.entries, design.noEntries, {
    knownFiles: new Set(files.map(({ path }) => path)),
    showFile: (path) => {
      select(path);
      byId("map", HTMLElement).scrollIntoView({ block: "start" });
    },
  });
};
