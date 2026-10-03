import { describe, expect, it } from "vitest";

import { recommendedOf } from "./recommend.js";

type Visible = Parameters<typeof recommendedOf>[0][number][number];

const territory = (id: string, heatShare: number): Visible => ({
  id,
  kind: "folder",
  parent: "t1",
  heatShare,
});

const bucket = (id: string): Visible => ({
  id,
  kind: "other",
  parent: "t1",
  heatShare: 0,
});

/** `count` territories at 0.1 of the heat each, and a bucket with the given id unless none is given. */
const detail = (count: number, bucketId?: string): ReadonlyArray<Visible> => [
  ...Array.from({ length: count }, (_, index) =>
    territory(`t${index + 10}`, 0.1),
  ),
  ...(bucketId === undefined ? [] : [bucket(bucketId)]),
];

describe("recommendedOf", () => {
  it("takes the finest detail with at most 25 territories", () => {
    expect(recommendedOf([detail(5), detail(25), detail(26)], new Map())).toBe(
      2,
    );
  });

  it("refuses a detail whose bucket hides a folder hotter than a territory opened beside it", () => {
    const hidden = new Map([
      ["b2", 0.2],
      ["b3", 0.05],
    ]);

    expect(
      recommendedOf(
        [detail(5, "b1"), detail(10, "b2"), detail(20, "b3")],
        hidden,
      ),
    ).toBe(3);
    expect(
      recommendedOf(
        [detail(5, "b1"), detail(10, "b3"), detail(20, "b2")],
        hidden,
      ),
    ).toBe(2);
  });

  it("moves to the next finer detail when none with few enough territories hides nothing", () => {
    const hidden = new Map([
      ["b1", 0.2],
      ["b2", 0.2],
    ]);

    expect(
      recommendedOf(
        [detail(5, "b1"), detail(25, "b2"), detail(30, "b3")],
        hidden,
      ),
    ).toBe(3);
  });

  it("keeps the finest detail with few enough territories when every detail hides something", () => {
    const hidden = new Map([
      ["b1", 0.2],
      ["b2", 0.2],
      ["b3", 0.2],
    ]);

    expect(
      recommendedOf(
        [detail(5, "b1"), detail(25, "b2"), detail(30, "b3")],
        hidden,
      ),
    ).toBe(2);
  });

  it("ignores a bucket that has no territory beside it", () => {
    expect(
      recommendedOf([[bucket("b1")], detail(3, "b2")], new Map([["b1", 0.5]])),
    ).toBe(2);
  });
});
