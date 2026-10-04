import { splitPath } from "./format.js";

type Child = Node | string;

/**
 * Creates an element from a tag, a class list and children. String children
 * become text nodes, so untrusted text (file paths) never parses as markup.
 */
export const h = <K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  ...children: readonly Child[]
): HTMLElementTagNameMap[K] => {
  const element = document.createElement(tag);
  element.className = className;
  element.append(...children);
  return element;
};

/**
 * Text that may wrap after each `/` and nowhere inside a word: a path in a
 * narrow box breaks between its folders instead of through a name.
 */
export const breakable = (text: string): Child[] =>
  text
    .split("/")
    .flatMap((part, index, parts) =>
      index === parts.length - 1
        ? [part]
        : [`${part}/`, document.createElement("wbr")],
    );

/** Keeps a flag such as `--since` on one line: the text splits before each flag, which becomes a `.flag` span. */
export const withFlags = (text: string): (Node | string)[] =>
  text
    .split(/(--[a-z]+)/u)
    .map((part, index) => (index % 2 === 1 ? h("span", "flag", part) : part));

/** Finds a skeleton element of the page, failing loudly when the page and script disagree. */
export const byId = <T extends Element>(
  id: string,
  type: abstract new () => T,
): T => {
  const element = document.querySelector(`#${id}`);
  if (!(element instanceof type)) {
    throw new TypeError(`The page has no <${type.name}> with id "${id}".`);
  }
  return element;
};

/** Creates SVG elements; see `svgFactory`. */
export type SvgFactory = (
  tag: string,
  attributes?: Readonly<Record<string, string | number>>,
) => SVGElement;

/**
 * SVG element factory bound to an existing `<svg>`. The namespace is read from
 * the parser-created root, so the page carries no namespace URL of its own.
 */
export const svgFactory =
  (root: SVGSVGElement): SvgFactory =>
  (tag, attributes = {}) => {
    const element = document.createElementNS(root.namespaceURI, tag);
    for (const [name, value] of Object.entries(attributes)) {
      element.setAttribute(name, String(value));
    }
    if (!(element instanceof SVGElement)) {
      throw new TypeError(`<${tag}> is not an SVG element.`);
    }
    return element;
  };

/** A path with its directory receding and its last segment emphasized. */
export const pathLabel = (path: string): HTMLElement => {
  const { dir, name } = splitPath(path);
  return h(
    "span",
    "path",
    h("span", "path-dir", dir),
    h("strong", "path-name", name),
  );
};

/** A titled block of the side panel. */
export const section = (
  title: string,
  ...content: readonly Node[]
): HTMLElement => h("section", "panel-section", h("h3", "", title), ...content);
