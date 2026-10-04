import { h } from "../render/dom.js";

/**
 * A bar filled to `value` (0..1) with a tick at `reference` when there is one.
 * It only draws; the numbers beside it say the same in words.
 */
export const meterView = (
  value: number,
  reference: number | null,
): HTMLElement => {
  const fill = h("span", "meter-fill", "");
  fill.style.width = `${Math.round(Math.min(1, Math.max(0, value)) * 100)}%`;
  const meter = h("span", "meter", fill);
  meter.setAttribute("aria-hidden", "true");
  if (reference !== null) {
    const tick = h("span", "meter-tick", "");
    tick.style.left = `${Math.round(Math.min(1, Math.max(0, reference)) * 100)}%`;
    meter.append(tick);
  }
  return meter;
};
