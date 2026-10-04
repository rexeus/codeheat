// Owns where keyboard focus goes around a zoom: into the zoom bar when a
// territory fills the map, and back to the control that asked for it when the
// bar goes away.

/** Anything that can hold focus and may have left the page. */
type Focusable = { readonly isConnected: boolean };

/**
 * The control that started a zoom: the element that had focus, unless focus
 * was on nothing in particular (`body`, or no element), in which case no
 * control is remembered.
 */
export const zoomOrigin = <T extends Focusable>(
  active: T | null,
  body: T,
): T | null => (active === null || active === body ? null : active);

/**
 * Where focus returns to when the zoom ends: the control that started it if
 * it is still on the page, else `fallback` (the grouping switch).
 */
export const returnFocusTo = <T extends Focusable>(
  origin: T | null,
  fallback: T,
): T => (origin?.isConnected === true ? origin : fallback);
