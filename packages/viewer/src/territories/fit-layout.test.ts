import { describe, expect, it } from "vitest";

import { layoutFitMap } from "./fit-layout.js";

const area = ({ width, height }: { width: number; height: number }): number =>
  width * height;

describe("layoutFitMap", () => {
  const tiles = [
    { id: "a", weight: 4 },
    { id: "b", weight: 2 },
    { id: "c", weight: 1 },
    { id: "d", weight: 1 },
  ];
  const size = { width: 800, height: 400 };

  it("places every tile inside the map", () => {
    const placed = layoutFitMap(tiles, size);

    expect([...placed.keys()].toSorted()).toEqual(["a", "b", "c", "d"]);
    for (const { x, y, width, height } of placed.values()) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(x + width).toBeLessThanOrEqual(size.width + 1e-6);
      expect(y + height).toBeLessThanOrEqual(size.height + 1e-6);
    }
  });

  it("gives tiles area in proportion to their weight, less the gaps", () => {
    const placed = layoutFitMap(tiles, size);
    const areaOf = (id: string): number =>
      area(placed.get(id) ?? { width: 0, height: 0 });

    expect(areaOf("a") / areaOf("c")).toBeGreaterThan(3.5);
    expect(areaOf("a") / areaOf("c")).toBeLessThan(4.5);
    expect(areaOf("c") / areaOf("d")).toBeGreaterThan(0.9);
    expect(areaOf("c") / areaOf("d")).toBeLessThan(1.1);
  });

  it("lets no two tiles overlap", () => {
    const rects = [...layoutFitMap(tiles, size).values()];

    for (const [index, one] of rects.entries()) {
      for (const other of rects.slice(index + 1)) {
        const apartX =
          one.x + one.width <= other.x + 1e-6 ||
          other.x + other.width <= one.x + 1e-6;
        const apartY =
          one.y + one.height <= other.y + 1e-6 ||
          other.y + other.height <= one.y + 1e-6;
        expect(apartX || apartY).toBe(true);
      }
    }
  });

  it("places nothing without tiles or without room", () => {
    expect(layoutFitMap([], size).size).toBe(0);
    expect(layoutFitMap(tiles, { width: 0, height: 400 }).size).toBe(0);
  });
});
