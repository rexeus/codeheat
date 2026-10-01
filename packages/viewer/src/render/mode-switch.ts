import {
  hashOfMode,
  modeFromHash,
  parseColorMode,
} from "../color/color-mode.js";

/**
 * Wires the "Heat | Cohesion" radio group. The mode lives on `app` as
 * `data-mode`, which the stylesheet reads to color tiles, order the panel and
 * show the matching legend entry, so a change repaints nothing in script. The
 * page opens in the mode its address fragment names (`#mode=cohesion`), and
 * the fragment follows the switch so the current view can be linked.
 */
export const mountModeSwitch = (
  app: HTMLElement,
  group: HTMLFieldSetElement,
): void => {
  const initial = modeFromHash(window.location.hash);
  app.dataset["mode"] = initial;
  for (const input of group.querySelectorAll("input")) {
    input.checked = input.value === initial;
  }
  group.addEventListener("change", ({ target }) => {
    const mode =
      target instanceof HTMLInputElement ? parseColorMode(target.value) : null;
    if (mode === null) {
      return;
    }
    app.dataset["mode"] = mode;
    const { pathname, search } = window.location;
    window.history.replaceState(null, "", pathname + search + hashOfMode(mode));
  });
};
