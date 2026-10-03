import { describe, expect, it } from "vitest";

import { sliceRanges, sliceStarts } from "./slice-ranges.js";

describe("sliceRanges", () => {
  it("cuts a year into four equal windows that meet and cover it", () => {
    const ranges = sliceRanges({
      since: "2025-06-01T00:00:00.000Z",
      until: "2026-06-01T00:00:00.000Z",
    });

    expect(ranges).toStrictEqual([
      { since: "2025-06-01T00:00:00.000Z", until: "2025-08-31T06:00:00.000Z" },
      { since: "2025-08-31T06:00:00.000Z", until: "2025-11-30T12:00:00.000Z" },
      { since: "2025-11-30T12:00:00.000Z", until: "2026-03-01T18:00:00.000Z" },
      { since: "2026-03-01T18:00:00.000Z", until: "2026-06-01T00:00:00.000Z" },
    ]);
  });

  it("uses twelve windows at most, however long the range", () => {
    const ranges = sliceRanges({
      since: "2016-06-01T00:00:00.000Z",
      until: "2026-06-01T00:00:00.000Z",
    });

    expect(ranges).toHaveLength(12);
    expect(ranges[0]?.since).toBe("2016-06-01T00:00:00.000Z");
    expect(ranges[11]?.until).toBe("2026-06-01T00:00:00.000Z");
  });

  it("cuts six months in two and leaves a shorter range uncut", () => {
    const until = "2026-06-01T00:00:00.000Z";

    expect(
      sliceRanges({ since: "2025-12-01T00:00:00.000Z", until }),
    ).toHaveLength(2);
    expect(
      sliceRanges({ since: "2026-04-20T00:00:00.000Z", until }),
    ).toStrictEqual([]);
  });
});

describe("sliceStarts", () => {
  it("lists where each window after the first begins, in seconds", () => {
    expect(
      sliceStarts([
        {
          since: "1970-01-01T00:00:00.000Z",
          until: "1970-01-01T00:01:00.000Z",
        },
        {
          since: "1970-01-01T00:01:00.000Z",
          until: "1970-01-01T00:02:30.000Z",
        },
        {
          since: "1970-01-01T00:02:30.000Z",
          until: "1970-01-01T00:03:00.000Z",
        },
      ]),
    ).toStrictEqual([60, 150]);
  });
});
