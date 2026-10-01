import type { FileStats, Module } from "@codeheat/engine";

import type { ColorMode } from "../color/color-mode.js";
import type { HeatScale } from "../color/heat-scale.js";
import type { Partner } from "../selection/partners.js";
import { h, pathLabel, section } from "./dom.js";
import { EMPTY_PANEL_NOTE } from "./empty-notice.js";
import {
  describeScoreTrend,
  formatCount,
  formatPercent,
  formatScore,
} from "./format.js";
import { fileModuleSection, leastCohesiveSection } from "./module-panel.js";

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
  readonly modules: readonly Module[];
  /** The module of a file; `undefined` when the report does not list it. */
  readonly moduleOf: (path: string) => Module | undefined;
  readonly thresholds: {
    readonly minSharedCommits: number;
    readonly minDegree: number;
    readonly minModuleCommits: number;
  };
};

export type PanelHandlers = {
  readonly select: (path: string) => void;
  readonly clear: () => void;
};

/** Hotspots the overview lists; they always stay individual tiles. */
export const OVERVIEW_HOTSPOTS = 10;

type Context = PanelData & Pick<PanelHandlers, "select">;

const swatch = (heat: HeatScale, score: number): HTMLElement => {
  const element = h("span", "swatch");
  element.dataset["step"] = String(heat(score));
  return element;
};

const stat = (value: string, label: string): HTMLElement =>
  h("div", "stat", h("strong", "", value), h("span", "", label));

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
  if (partner.crossesModule) {
    meta.append(h("span", "badge cross-module", "other module"));
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
  { files, heat, moduleOf }: Context,
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
      ...(file.trend === null ? [] : [h("span", "", trendText(file.trend))]),
    ),
  ),
  h(
    "div",
    "stats",
    stat(formatCount(file.revisions), "revisions"),
    stat(formatCount(file.breadth), "co-changed files"),
    stat(formatCount(file.loc), "lines of code"),
    stat(formatCount(file.complexity.total), "complexity"),
    stat(
      `+${formatCount(file.linesAdded)} −${formatCount(file.linesDeleted)}`,
      "lines changed",
    ),
  ),
  ...fileModuleSection(moduleOf(file.path)),
  section(
    "Why it stands out",
    h("ul", "reasons", ...file.reasons.map((reason) => h("li", "", reason))),
  ),
];

const trendText = (trend: NonNullable<FileStats["trend"]>): string => {
  const { value, note } = describeScoreTrend(trend);
  return `${value}: ${note}`;
};

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

const hotspotsSection = (rows: readonly HTMLElement[]): HTMLElement => {
  const element = section("Top hotspots", h("ul", "list", ...rows));
  element.dataset["overview"] = "hotspots";
  return element;
};

/** Marks `element` for one color mode; the stylesheet hides it in the other. */
const forMode = (mode: ColorMode, element: HTMLElement): HTMLElement => {
  element.dataset["modeOnly"] = mode;
  return element;
};

/** The overview's title and intro in each color mode. */
const overviewIntro = (): HTMLElement[] => [
  forMode("heat", h("h2", "panel-title", "Hotspots")),
  forMode(
    "heat",
    h(
      "p",
      "hint",
      "Big and hot: many lines, changed often, deeply nested. Select a tile to outline the files that change together with it.",
    ),
  ),
  forMode("cohesion", h("h2", "panel-title", "Modules")),
  forMode(
    "cohesion",
    h(
      "p",
      "hint",
      "Cohesion is the share of a module's commits that touch no other module; low means its changes spread. Tiles take the color of their module. Select a tile to outline the files that change together with it.",
    ),
  ),
  forMode("change", h("h2", "panel-title", "Change")),
  forMode(
    "change",
    h(
      "p",
      "hint",
      "Cooler tiles got less hot than the window before, warmer tiles hotter; scores are normalized within each window, so this is a shift in standing. Files that were not active before are neutral. Select a tile to outline the files that change together with it.",
    ),
  ),
];

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
        ...(rows.length === 0
          ? [
              h("h2", "panel-title", "Hotspots"),
              h("p", "hint", EMPTY_PANEL_NOTE),
            ]
          : [
              ...overviewIntro(),
              h(
                "div",
                "overview-sections",
                hotspotsSection(rows),
                leastCohesiveSection(
                  data.modules,
                  data.thresholds.minModuleCommits,
                ),
              ),
            ]),
      );
      root.scrollTop = 0;
    },
  };
};
