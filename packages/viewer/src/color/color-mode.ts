// Owns the tile color modes and how the page address selects one.

/**
 * What tile color encodes: `heat` is the hotspot rank, `cohesion` is the
 * module's cohesion, `change` is how a file's score moved since the previous
 * window (only meaningful for a report made with `--compare`).
 */
export type ColorMode = "heat" | "cohesion" | "change";

/** The mode named `value`, or `null` when there is none. */
export const parseColorMode = (value: string | null): ColorMode | null =>
  value === "heat" || value === "cohesion" || value === "change" ? value : null;

/**
 * The mode a page address asks for: `#mode=cohesion` opens the cohesion view
 * and `#mode=change` the change view, which makes the view linkable. Anything
 * else, including a missing or unknown mode and `change` when the report has
 * no comparison (`hasComparison` false), is `heat`.
 */
export const modeFromHash = (
  hash: string,
  hasComparison: boolean,
): ColorMode => {
  const requested = parseColorMode(
    new URLSearchParams(hash.replace(/^#/u, "")).get("mode"),
  );
  return requested === "change" && !hasComparison
    ? "heat"
    : (requested ?? "heat");
};

/** The address fragment that reopens `mode`; the default mode needs none. */
export const hashOfMode = (mode: ColorMode): string =>
  mode === "heat" ? "" : `#mode=${mode}`;
