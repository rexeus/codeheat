import type { Report } from "@codeheat/engine";

import type { HeroData } from "../hero/hero-data.js";
import { mountHero } from "../hero/mount-hero.js";
import { indexTerritories } from "../territories/territory-index.js";
import { cardSourceOf } from "../territory-cards/card-model.js";
import { mountCards } from "../territory-cards/mount-cards.js";
import { mountStart } from "../where-to-start/mount-start.js";
import { byId } from "./dom.js";
import type { FileLinkContext } from "./file-link.js";

/**
 * Links to files: a file the page names is selected in the map, which scrolls
 * into view; a file the report does not list is not offered as a link.
 */
export const fileLinksOf = (
  report: Report,
  select: (path: string) => void,
): FileLinkContext => ({
  knownFiles: new Set(report.files.map(({ path }) => path)),
  showFile: (path) => {
    select(path);
    byId("map", HTMLElement).scrollIntoView({ block: "start" });
  },
});

/** Renders the hero, "Where to start" and "Where the heat is" from `design`, linking into the map through `files`. */
export const mountDesignFit = (
  design: HeroData,
  report: Report,
  files: FileLinkContext,
): void => {
  mountHero(design);
  mountStart(design.entries, design.noEntries, files);
  mountCards(
    cardSourceOf(report, indexTerritories(report.territories), design.entries),
    report,
    files,
  );
};
