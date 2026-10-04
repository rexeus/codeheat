import { h } from "../render/dom.js";
import { formatShare } from "../render/format.js";
import type { Standing } from "../territories/judgement.js";
import type { NameParts } from "../territories/territory-index.js";
import { icon } from "./icon.js";

/** A territory's name: its folder receding, the part that tells it apart in bold. The full name is the tooltip, since a narrow row cuts it. */
export const nameLabel = (
  { dir, base }: NameParts,
  short = false,
): HTMLElement => {
  const label = h(
    "span",
    "tname",
    ...(short || dir === "" ? [] : [h("span", "tname-dir", dir)]),
    h("span", "tname-base", base),
  );
  label.title = `${dir}${base}`;
  return label;
};

/** A bar filled to `fraction` (0..1) of its track. */
export const bar = (fraction: number): HTMLElement => {
  const fill = h("span", "bar-fill", "");
  fill.style.width = `${Math.max(0, Math.min(1, fraction)) * 100}%`;
  return h("span", "bar", fill);
};

/** How a territory holds up, in words with an icon: never by color alone. */
export const standingTag = (standing: Standing): HTMLElement => {
  if (standing.kind === "unjudged") {
    return h("span", "tag", standing.reason);
  }
  const leaks = standing.kind === "leaks";
  const tag = h(
    "span",
    "tag",
    icon(leaks ? "leak" : "shield"),
    `${leaks ? "leaks" : "holds"} · ${formatShare(standing.containment)} stays`,
  );
  tag.dataset["standing"] = standing.kind;
  return tag;
};

/** The rows of a chart, flowing into two columns where there is room. */
export const chartRows = (
  rows: readonly HTMLElement[],
  className: string,
): HTMLElement => {
  const list = h("div", `chart-rows ${className}`, ...rows);
  list.style.setProperty("--rows", String(Math.ceil(rows.length / 2)));
  return list;
};

/** A line under a chart, such as how many rows it leaves out; nothing when `text` is empty. */
export const chartNote = (text: string): HTMLElement[] =>
  text === "" ? [] : [h("p", "chart-note", text)];
