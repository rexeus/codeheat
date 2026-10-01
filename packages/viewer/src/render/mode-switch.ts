import {
  hashOfMode,
  modeFromHash,
  parseColorMode,
} from "../color/color-mode.js";
import type { ColorMode } from "../color/color-mode.js";

/**
 * Wires the "Heat | Cohesion" radio group. The mode lives on `app` as
 * `data-mode`, which the stylesheet reads to color tiles, order the panel,
 * pick the overview text and show the matching legend entry, so a change
 * repaints nothing in script. The page opens in the mode its address fragment
 * names (`#mode=cohesion`) and follows later fragment changes (back button, a
 * pasted link); the fragment follows the switch so the current view can be
 * linked.
 */
export const mountModeSwitch = (
  app: HTMLElement,
  group: HTMLFieldSetElement,
): void => {
  const show = (mode: ColorMode): void => {
    app.dataset["mode"] = mode;
    for (const input of group.querySelectorAll("input")) {
      input.checked = input.value === mode;
    }
  };
  show(modeFromHash(window.location.hash));
  window.addEventListener("hashchange", () => {
    show(modeFromHash(window.location.hash));
  });
  group.addEventListener("change", ({ target }) => {
    const mode =
      target instanceof HTMLInputElement ? parseColorMode(target.value) : null;
    if (mode === null) {
      return;
    }
    show(mode);
    const { pathname, search } = window.location;
    window.history.replaceState(null, "", pathname + search + hashOfMode(mode));
  });
};
