import type { Report } from "@codeheat/engine";

import type { HeroData } from "../hero/hero-data.js";
import { mountHero } from "../hero/mount-hero.js";
import { indexTerritories } from "../territories/territory-index.js";
import { cardSourceOf } from "../territory-cards/card-model.js";
import { mountCards } from "../territory-cards/mount-cards.js";
import { mountTogether } from "../together/mount-together.js";
import { mountStart } from "../where-to-start/mount-start.js";
import { byId } from "./dom.js";
import type { MapLinks } from "./file-link.js";

const scrollToMap = (): void => {
  byId("map", HTMLElement).scrollIntoView({ block: "start" });
};

/**
 * How a link into the map works on the page: a file the report lists is
 * selected, a territory zoomed to, and the map scrolls into view; a file the
 * report does not list (after `--limit`) is not offered as a link.
 */
export const mapLinksOf = (
  report: Report,
  select: (path: string) => void,
  zoom: (territory: string) => void,
): MapLinks => ({
  knownFiles: new Set(report.files.map(({ path }) => path)),
  showFile: (path) => {
    select(path);
    scrollToMap();
  },
  showTerritory: (id) => {
    zoom(id);
    scrollToMap();
  },
});

/** Renders the sections above the map: the hero, "Where to start", "Where the heat is", and "What changes together", linking into the map through `links`. */
export const mountSections = (
  report: Report,
  design: HeroData,
  links: MapLinks,
): void => {
  mountHero(design, links.showTerritory);
  mountStart(design.entries, design.noEntries, links);
  mountCards(
    cardSourceOf(report, indexTerritories(report.territories), design.entries),
    report,
    links,
  );
  mountTogether(report, links);
};
