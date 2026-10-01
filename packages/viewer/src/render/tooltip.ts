import type { AggregateNode, FileNode } from "../layout/hierarchy.js";
import type { PlacedLeaf } from "../layout/treemap.js";
import type { ModuleIndex } from "../modules/module-index.js";
import { h } from "./dom.js";
import {
  formatCount,
  formatPercent,
  formatScore,
  splitPath,
} from "./format.js";

/** Metrics readout that follows the pointer over the treemap. */
export type Tooltip = {
  readonly show: (leaf: PlacedLeaf, event: PointerEvent) => void;
  readonly hide: () => void;
};

const POINTER_OFFSET = 14;

/** A value with its label: the value leads, the label recedes. */
const row = (value: string, label: string): HTMLElement =>
  h("div", "tooltip-row", h("strong", "", value), h("span", "", ` ${label}`));

const pathLine = (path: string): HTMLElement => {
  const { dir, name } = splitPath(path);
  return h(
    "div",
    "tooltip-path",
    h("span", "muted", dir),
    h("strong", "", name),
  );
};

/** The file's module and how many of its changes stay inside; nothing when the module is unknown. */
const moduleRows = (path: string, modules: ModuleIndex): HTMLElement[] => {
  const module = modules.moduleOf(path);
  if (module === undefined) {
    return [];
  }
  return [
    row(
      module.cohesion === null ? "no data" : formatPercent(module.cohesion),
      `of changes to ${module.path} stay inside`,
    ),
  ];
};

const fileContent = (
  { file, path }: FileNode,
  totalFiles: number,
  modules: ModuleIndex,
): HTMLElement[] => [
  pathLine(path),
  row(
    formatScore(file.score),
    `hotspot score, rank #${file.rank} of ${formatCount(totalFiles)}`,
  ),
  row(formatCount(file.revisions), "revisions"),
  row(formatCount(file.loc), "lines of code"),
  row(
    formatCount(file.complexity.total),
    `indentation complexity (deepest ${file.complexity.max})`,
  ),
  row(
    `+${formatCount(file.linesAdded)} / −${formatCount(file.linesDeleted)}`,
    "lines changed",
  ),
  ...moduleRows(path, modules),
];

const aggregateContent = (node: AggregateNode): HTMLElement[] => [
  h(
    "div",
    "tooltip-path",
    h("strong", "", node.name),
    h("span", "muted", ` in /${node.directory}`),
  ),
  row(formatCount(node.loc), "lines of code combined"),
  row(formatScore(node.score), "highest hotspot score among them"),
];

export const createTooltip = (
  element: HTMLElement,
  stage: HTMLElement,
  totalFiles: number,
  modules: ModuleIndex,
): Tooltip => {
  const place = (event: PointerEvent): void => {
    const bounds = stage.getBoundingClientRect();
    const flipX =
      event.clientX + POINTER_OFFSET + element.offsetWidth > bounds.right;
    const flipY =
      event.clientY + POINTER_OFFSET + element.offsetHeight > bounds.bottom;
    const left = flipX
      ? event.clientX - POINTER_OFFSET - element.offsetWidth
      : event.clientX + POINTER_OFFSET;
    const top = flipY
      ? event.clientY - POINTER_OFFSET - element.offsetHeight
      : event.clientY + POINTER_OFFSET;
    element.style.left = `${Math.max(0, left - bounds.left)}px`;
    element.style.top = `${Math.max(0, top - bounds.top)}px`;
  };

  return {
    show: ({ node }, event) => {
      element.replaceChildren(
        ...(node.kind === "file"
          ? fileContent(node, totalFiles, modules)
          : aggregateContent(node)),
      );
      element.hidden = false;
      place(event);
    },
    hide: () => {
      element.hidden = true;
    },
  };
};
