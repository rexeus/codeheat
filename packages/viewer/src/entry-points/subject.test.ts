import { describe, expect, it } from "vitest";

import { subjectOf } from "./subject.js";

describe("subjectOf", () => {
  it("names the hub by its file name", () => {
    expect(subjectOf("hub", ["packages/core/src/types/ScoreDto.ts"])).toBe(
      "ScoreDto.ts",
    );
  });

  it("names the two files of a hidden coupling", () => {
    expect(
      subjectOf("coupling", ["core/src/reify.ts", "forms/src/foreign.ts"]),
    ).toBe("reify.ts ↔ foreign.ts");
  });

  it("names copies by their folders when they share a file name", () => {
    expect(
      subjectOf("copies", [
        "adev/basic/app/app.html",
        "adev/material/app/app.html",
        "adev/other/app/app.html",
        "adev/more/app/app.html",
      ]),
    ).toBe("basic/app/app.html, material/app/app.html +2 more");
  });

  it("names copies by their file names when those differ", () => {
    expect(subjectOf("copies", ["a/one.ts", "b/two.ts"])).toBe(
      "one.ts, two.ts",
    );
  });

  it("says nothing for a finding about territories or without files", () => {
    expect(subjectOf("boundary", ["a/b.ts"])).toBe("");
    expect(subjectOf("clique", [])).toBe("");
    expect(subjectOf("hub", [])).toBe("");
  });
});
