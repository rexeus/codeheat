import type {
  EntryView,
  FindingView,
  LeakTarget,
} from "../entry-points/entry-views.js";
import type { EntryStat } from "../entry-points/evidence.js";
import { breakable, h, pathLabel } from "../render/dom.js";
import { fileLink } from "../render/file-link.js";
import type { MapLinks } from "../render/file-link.js";
import { formatCount, formatShare } from "../render/format.js";
import { rankBadge } from "../render/rank-badge.js";
import { territoryName } from "../territories/territory-index.js";

/** Files a card offers to show in the map; the rest are counted. */
const MAX_FILE_LINKS = 3;

const statView = ({ value, label }: EntryStat): HTMLElement =>
  h("li", "entry-stat", h("strong", "", value), h("span", "", label));

const alsoView = ({ kindLabel, verdict, stats }: FindingView): HTMLElement =>
  h(
    "p",
    "entry-also",
    h("span", "chip", kindLabel),
    ` ${verdict}`,
    ...(stats.length === 0
      ? []
      : [
          h(
            "span",
            "entry-also-stats",
            stats.map(({ value, label }) => `${value} ${label}`).join(" · "),
          ),
        ]),
  );

const leakView = ({ name, share, sharedChanges }: LeakTarget): HTMLElement =>
  h(
    "p",
    "entry-leak",
    "Leaks into ",
    h("strong", "", name),
    `: ${formatShare(share)} of its changes (${formatCount(sharedChanges)}) touch both.`,
  );

const headingView = (entry: EntryView): HTMLElement =>
  h(
    "h3",
    "entry-title",
    ...entry.heading.map((name) =>
      name.includes("/") && !name.includes(" + ")
        ? pathLabel(name)
        : h("span", "path", ...breakable(name)),
    ),
  );

const linksView = (entry: EntryView, context: MapLinks): HTMLElement | null => {
  const onMap = entry.territories.map((territory) => {
    const { id } = territory;
    const name = territoryName(territory);
    const link = h("a", "map-link", `${name} on the fit map`);
    link.href = `#territory-${id}`;
    const show = h("button", "map-link show-on-map", "Show in the map");
    show.type = "button";
    show.setAttribute("aria-label", `Show ${name} in the map`);
    show.addEventListener("click", () => {
      context.showTerritory(id);
    });
    return h("span", "entry-territory", link, show);
  });
  const files = entry.files.slice(0, MAX_FILE_LINKS);
  const rest = entry.files.length - files.length;
  if (onMap.length === 0 && files.length === 0) {
    return null;
  }
  return h(
    "footer",
    "entry-links",
    ...onMap,
    ...(files.length === 0
      ? []
      : [
          h(
            "span",
            "entry-files",
            h("span", "muted", "In the map:"),
            ...files.map((path) => fileLink(path, context)),
            ...(rest > 0 ? [h("span", "muted", `+${rest} more`)] : []),
          ),
        ]),
  );
};

/** One place to start: what is wrong, what to do, the numbers behind it, and where to look. */
export const entryCard = (entry: EntryView, context: MapLinks): HTMLElement => {
  const card = h(
    "article",
    "entry",
    h(
      "header",
      "entry-head",
      rankBadge(entry.rank, null),
      h("span", "chip", entry.kindLabel),
      ...(entry.moveLabel === ""
        ? []
        : [h("span", "chip move", entry.moveLabel)]),
    ),
    headingView(entry),
    ...(entry.context === "" ? [] : [h("p", "entry-context", entry.context)]),
    h("p", "entry-verdict", entry.verdict),
    ...(entry.leaksTo === null ? [] : [leakView(entry.leaksTo)]),
    h("p", "entry-move", entry.move),
    h("ul", "entry-stats", ...entry.stats.map(statView)),
    ...entry.also.map(alsoView),
  );
  card.id = entry.anchor;
  const links = linksView(entry, context);
  if (links !== null) {
    card.append(links);
  }
  return card;
};
