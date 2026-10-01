// Owns the tile color modes and how the page address selects one.

/** What tile color encodes: `heat` is the hotspot rank, `cohesion` is the module's cohesion. */
export type ColorMode = "heat" | "cohesion";

/** The mode named `value`, or `null` when there is none. */
export const parseColorMode = (value: string | null): ColorMode | null =>
  value === "heat" || value === "cohesion" ? value : null;

/**
 * The mode a page address asks for: `#mode=cohesion` opens the cohesion view,
 * which makes the view linkable. Anything else, including a missing or
 * unknown mode, is `heat`.
 */
export const modeFromHash = (hash: string): ColorMode => {
  const requested = new URLSearchParams(hash.replace(/^#/u, "")).get("mode");
  return parseColorMode(requested) ?? "heat";
};

/** The address fragment that reopens `mode`; the default mode needs none. */
export const hashOfMode = (mode: ColorMode): string =>
  mode === "heat" ? "" : `#mode=${mode}`;
