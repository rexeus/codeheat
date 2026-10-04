// Owns reading the project's own `<description>` out of a `pom.xml`. The text
// is untrusted: it is scanned once, tag by tag, and nothing is evaluated.

const ENTITY = /&(#x[\da-f]+|#\d+|lt|gt|amp|quot|apos);/giu;
const NAMED_ENTITIES: Readonly<Record<string, string>> = {
  lt: "<",
  gt: ">",
  amp: "&",
  quot: '"',
  apos: "'",
};
const LAST_CODE_POINT = 0x10_ff_ff;

/** The character a numeric reference (`#65`, `#x41`) names; undefined when it names none. */
const referencedCharacter = (reference: string): string | undefined => {
  const code = Math.trunc(
    Number(
      reference.startsWith("#x")
        ? `0${reference.slice(1)}`
        : reference.slice(1),
    ),
  );
  return code > 0 && code <= LAST_CODE_POINT
    ? String.fromCodePoint(code)
    : undefined;
};

/** The five named XML entities and numeric character references; anything else stays as written. */
const decodeEntities = (text: string): string =>
  text.replaceAll(ENTITY, (whole, name: string) => {
    const lower = name.toLowerCase();
    return (
      (lower.startsWith("#")
        ? referencedCharacter(lower)
        : NAMED_ENTITIES[lower]) ?? whole
    );
  });

/** A tag found in XML: its name, whether it closes or is empty, and where it ends. */
type Tag = {
  readonly name: string;
  readonly closing: boolean;
  readonly empty: boolean;
  readonly end: number;
};

/** What starts with `<` and runs to a terminator that is no tag: a comment, a CDATA section, an instruction, a declaration. */
const NON_TAGS = [
  ["<!--", "-->"],
  ["<![CDATA[", "]]>"],
  ["<?", "?>"],
  ["<!", ">"],
] as const;

/** The tag that starts at or after `start`, or where to resume after a comment, CDATA section, or declaration; undefined at the end of the text. */
const nextTag = (
  text: string,
  start: number,
): Tag | { readonly skipTo: number } | undefined => {
  const open = text.indexOf("<", start);
  if (open < 0) {
    return undefined;
  }
  const nonTag = NON_TAGS.find(([opening]) => text.startsWith(opening, open));
  const closeAt = text.indexOf(nonTag?.[1] ?? ">", open + 1);
  if (closeAt < 0) {
    return undefined;
  }
  if (nonTag !== undefined) {
    return { skipTo: closeAt + nonTag[1].length };
  }
  const inside = text.slice(open + 1, closeAt);
  return {
    name: /^\/?\s*([^\s/>]+)/u.exec(inside)?.[1] ?? "",
    closing: inside.startsWith("/"),
    empty: inside.endsWith("/"),
    end: closeAt + 1,
  };
};

/** How a tag changes the depth of nesting. */
const depthChange = ({ closing, empty }: Tag): number => {
  if (empty) {
    return 0;
  }
  return closing ? -1 : 1;
};

/** The text of the element that starts at `at`, up to its closing tag, with character data unwrapped and entities decoded. */
const bodyFrom = (text: string, at: number): string | undefined => {
  const close = text.indexOf("</description>", at);
  return close < 0
    ? undefined
    : decodeEntities(
        text.slice(at, close).replaceAll(/<!\[CDATA\[([\s\S]*?)\]\]>/gu, "$1"),
      );
};

/**
 * The project's own `<description>`: the one that is a direct child of the
 * root element, so not the one of the parent or of a plugin and not one inside
 * a comment; character data and entities decoded.
 */
export const pomDescription = (text: string): string | undefined => {
  let depth = 0;
  let at = 0;
  for (
    let step = nextTag(text, at);
    step !== undefined;
    step = nextTag(text, at)
  ) {
    if ("skipTo" in step) {
      at = step.skipTo;
      continue;
    }
    at = step.end;
    if (!step.closing && step.name === "description" && depth === 1) {
      return step.empty ? undefined : bodyFrom(text, at);
    }
    depth += depthChange(step);
  }
  return undefined;
};
