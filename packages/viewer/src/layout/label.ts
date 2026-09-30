/** Approximate glyph width of the 11px system font used for tile labels. */
const CHARACTER_WIDTH = 6.2;
const ELLIPSIS = "…";

/**
 * Shortens `text` with an ellipsis so it fits `width` pixels, or returns
 * `null` when not even a few characters fit and the label should be omitted.
 */
export const fitLabel = (text: string, width: number): string | null => {
  const capacity = Math.floor(width / CHARACTER_WIDTH);
  if (text.length <= capacity) {
    return text;
  }
  return capacity < 4 ? null : `${text.slice(0, capacity - 1)}${ELLIPSIS}`;
};
