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
