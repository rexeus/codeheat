import { byId, svgFactory } from "../render/dom.js";

/** The symbols of the page's icon sprite (`#icons` in the page template). */
export type IconName =
  | "flame"
  | "link"
  | "leak"
  | "target"
  | "shield"
  | "scale"
  | "worse"
  | "better"
  | "steady"
  | "hub"
  | "copies"
  | "unit";

/** A decorative icon from the page's sprite; screen readers skip it, so text beside it must carry the meaning. */
export const icon = (name: IconName): SVGElement => {
  const make = svgFactory(byId("icons", SVGSVGElement));
  const svg = make("svg", { class: "icon", "aria-hidden": "true" });
  svg.append(make("use", { href: `#icon-${name}` }));
  return svg;
};
