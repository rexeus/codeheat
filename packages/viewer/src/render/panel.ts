import type { FileStats } from "@codeheat/engine";

import type { HeatScale } from "../color/heat-scale.js";
import type { Partner } from "../selection/partners.js";
import { h } from "./dom.js";
import {
  formatCount,
  formatPercent,
  formatScore,
  splitPath,
} from "./format.js";

/** Side panel: an overview until a file is selected, then its reasons and partners. */
export type Panel = {
  readonly showOverview: () => void;
  readonly showFile: (path: string, partners: readonly Partner[]) => void;
};

export type PanelData = {
  readonly files: ReadonlyMap<string, FileStats>;
  /** Hottest first. */
  readonly hotspots: readonly FileStats[];
  readonly heat: HeatScale;
  readonly thresholds: {
    readonly minSharedCommits: number;
    readonly minDegree: number;
  };
};

export type PanelHandlers = {
  readonly select: (path: string) => void;
  readonly clear: () => void;
};

const OVERVIEW_HOTSPOTS = 10;

type Context = PanelData & Pick<PanelHandlers, "select">;

const swatch = (heat: HeatScale, score: number): HTMLElement => {
  const element = h("span", "swatch");
  element.dataset["step"] = String(heat(score));
  return element;
};

const pathLabel = (path: string): HTMLElement => {
  const { dir, name } = splitPath(path);
  return h(
    "span",
    "path",
    h("span", "path-dir", dir),
    h("strong", "path-name", name),
  );
};

const stat = (value: string, label: string): HTMLElement =>
  h("div", "stat", h("strong", "", value), h("span", "", label));

const section = (title: string, ...content: readonly Node[]): HTMLElement =>
  h("section", "panel-section", h("h3", "", title), ...content);

const distanceLabel = (distance: number): string => {
  if (distance === 0) {
    return "same folder";
  }
  return `${distance} ${distance === 1 ? "folder" : "folders"} apart`;
};

/** A button that selects `path`, keyed by the heat swatch of that file. */
const fileButton = (
  { files, heat, select }: Context,
  path: string,
  ...content: readonly Node[]
): HTMLButtonElement => {
  const button = h(
    "button",
    "file-button",
    swatch(heat, files.get(path)?.score ?? 0),
    ...content,
  );
  button.type = "button";
  button.addEventListener("click", () => {
    select(path);
  });
  return button;
};

const partnerRow = (context: Context, partner: Partner): HTMLElement => {
  const bar = h("span", "degree-bar");
  bar.style.setProperty("--degree", String(partner.degree));
  const meta = h(
    "span",
    "partner-meta",
    h("span", "degree", bar, formatPercent(partner.degree)),
    h("span", "", `${formatCount(partner.sharedCommits)} shared commits`),
    h("span", "", distanceLabel(partner.distance)),
  );
  if (partner.testPair) {
    meta.append(h("span", "badge", "test pair"));
  }
  return h(
    "li",
    "",
    fileButton(
      context,
      partner.path,
      h("span", "partner-body", pathLabel(partner.path), meta),
    ),
  );
};

const partnersSection = (
  context: Context,
  partners: readonly Partner[],
): HTMLElement => {
  const { minSharedCommits, minDegree } = context.thresholds;
  return section(
    `Changes together with · ${formatCount(partners.length)}`,
    partners.length === 0
      ? h(
          "p",
          "hint",
          `No file changes with this one in at least ${minSharedCommits} commits at a coupling of ${formatPercent(minDegree)} or more.`,
        )
      : h(
          "ul",
          "list",
          ...partners.map((partner) => partnerRow(context, partner)),
        ),
  );
};

const fileSections = (
  { files, heat }: Context,
  file: FileStats,
): HTMLElement[] => [
  h(
    "div",
    "score-line",
    swatch(heat, file.score),
    h("strong", "score", formatScore(file.score)),
    h(
      "span",
      "score-meta",
      h("span", "", "hotspot score"),
      h("span", "", `rank #${file.rank} of ${formatCount(files.size)}`),
    ),
  ),
  h(
    "div",
    "stats",
    stat(formatCount(file.revisions), "revisions"),
    stat(formatCount(file.loc), "lines of code"),
    stat(formatCount(file.complexity.total), "complexity"),
    stat(
      `+${formatCount(file.linesAdded)} −${formatCount(file.linesDeleted)}`,
      "lines changed",
    ),
  ),
  section(
    "Why it stands out",
    h("ul", "reasons", ...file.reasons.map((reason) => h("li", "", reason))),
  ),
];

const hotspotRow = (context: Context, file: FileStats): HTMLElement =>
  h(
    "li",
    "",
    fileButton(
      context,
      file.path,
      h("span", "rank", `#${file.rank}`),
      pathLabel(file.path),
      h("span", "score-chip", formatScore(file.score)),
    ),
  );

export const createPanel = (
  root: HTMLElement,
  data: PanelData,
  { select, clear }: PanelHandlers,
): Panel => {
  const context: Context = { ...data, select };

  return {
    showFile: (path, partners) => {
      const file = data.files.get(path);
      const close = h("button", "close", "Clear · Esc");
      close.type = "button";
      close.addEventListener("click", clear);
      root.replaceChildren(
        h("div", "panel-head", h("h2", "panel-title", pathLabel(path)), close),
        ...(file === undefined ? [] : fileSections(context, file)),
        partnersSection(context, partners),
      );
      root.scrollTop = 0;
    },
    showOverview: () => {
      const rows = data.hotspots
        .slice(0, OVERVIEW_HOTSPOTS)
        .map((file) => hotspotRow(context, file));
      root.replaceChildren(
        h("h2", "panel-title", "Hotspots"),
        h(
          "p",
          "hint",
          "Big and hot: many lines, changed often, deeply nested. Select a tile to outline the files that change together with it.",
        ),
        section("Top hotspots", h("ul", "list", ...rows)),
      );
      root.scrollTop = 0;
    },
  };
};
