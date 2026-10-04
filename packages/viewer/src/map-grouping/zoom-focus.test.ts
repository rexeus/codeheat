import { describe, expect, it } from "vitest";

import { returnFocusTo, zoomOrigin } from "./zoom-focus.js";

const element = (isConnected: boolean) => ({ isConnected });

describe("zoomOrigin", () => {
  const body = element(true);

  it("remembers the control that had focus", () => {
    const tile = element(true);

    expect(zoomOrigin(tile, body)).toBe(tile);
  });

  it("remembers nothing when focus was on the page itself or nowhere", () => {
    expect(zoomOrigin(body, body)).toBeNull();
    expect(zoomOrigin(null, body)).toBeNull();
  });
});

describe("returnFocusTo", () => {
  const grouping = element(true);

  it("returns to the control that started the zoom while it is on the page", () => {
    const tile = element(true);

    expect(returnFocusTo(tile, grouping)).toBe(tile);
  });

  it("falls back to the grouping switch when that control is gone", () => {
    expect(returnFocusTo(element(false), grouping)).toBe(grouping);
  });

  it("falls back to the grouping switch when no control started the zoom", () => {
    expect(returnFocusTo(null, grouping)).toBe(grouping);
  });
});
