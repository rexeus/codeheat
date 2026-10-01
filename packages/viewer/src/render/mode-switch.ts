import {
  hashOfMode,
  modeFromHash,
  parseColorMode,
} from "../color/color-mode.js";
import type { ColorMode } from "../color/color-mode.js";

/** Shown on the disabled "Change" option, so it says how to enable it. */
const NO_COMPARISON_HINT =
  "Needs a report made with: codeheat analyze --compare <duration>";

/**
 * Wires the "Heat | Cohesion | Change" radio group. "Change" is only enabled
 * when the report compares two windows (`hasComparison`). The mode lives on
 * `app` as `data-mode`, which the stylesheet reads to color tiles, order the
 * panel, pick the overview text and show the matching legend entry, so a
 * change repaints nothing in script. The page opens in the mode its address
 * fragment names (`#mode=cohesion`) and follows later fragment changes (back
 * button, a pasted link); the fragment follows the switch so the current view
 * can be linked.
 */
export const mountModeSwitch = (
  app: HTMLElement,
  group: HTMLFieldSetElement,
  hasComparison: boolean,
): void => {
  const show = (mode: ColorMode): void => {
    app.dataset["mode"] = mode;
    for (const input of group.querySelectorAll("input")) {
      input.checked = input.value === mode;
    }
  };
  for (const input of group.querySelectorAll("input")) {
    if (input.value === "change" && !hasComparison) {
      input.disabled = true;
      input.parentElement?.setAttribute("title", NO_COMPARISON_HINT);
    }
  }
  show(modeFromHash(window.location.hash, hasComparison));
  window.addEventListener("hashchange", () => {
    show(modeFromHash(window.location.hash, hasComparison));
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
