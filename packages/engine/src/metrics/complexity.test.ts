import { describe, expect, it } from "vitest";

import { measureComplexity } from "./complexity.js";

describe("measureComplexity", () => {
  it("counts one level per two spaces in a file indented by two", () => {
    const text = ["function f() {", "  if (x) {", "    y();", "  }", "}"].join(
      "\n",
    );

    expect(measureComplexity(text)).toStrictEqual({
      loc: 5,
      total: 4,
      mean: 0.8,
      max: 2,
    });
  });

  it("counts one level per four spaces in a file indented by four", () => {
    const text = [
      "class A {",
      "    m() {",
      "        return 1;",
      "    }",
      "}",
    ].join("\n");

    expect(measureComplexity(text)).toStrictEqual({
      loc: 5,
      total: 4,
      mean: 0.8,
      max: 2,
    });
  });

  it("counts a tab as one level", () => {
    expect(measureComplexity("a\n\tb\n\t\tc\n")).toStrictEqual({
      loc: 3,
      total: 3,
      mean: 1,
      max: 2,
    });
  });

  it("skips blank and whitespace-only lines", () => {
    expect(measureComplexity("a\n\n   \n  b\n")).toStrictEqual({
      loc: 2,
      total: 1,
      mean: 0.5,
      max: 1,
    });
  });
});

describe("measureComplexity indent unit", () => {
  it("detects the most common indentation increase as the unit", () => {
    // increases of 4, 4 and 2 spaces: the unit is 4, so 10 spaces are 2 levels
    const text = ["a", "    b", "        c", "          d"].join("\n");

    expect(measureComplexity(text).total).toBe(5);
  });

  it("clamps the unit to at least two spaces", () => {
    // increases of 1 space would give a unit of 1; the unit is clamped to 2
    expect(measureComplexity("a\n b\n  c").total).toBe(1);
  });

  it("clamps the unit to at most eight spaces", () => {
    // one increase of 12 spaces: the unit is clamped to 8, so 12 spaces are 1 level
    expect(measureComplexity("a\n            b").total).toBe(1);
  });
});

describe("measureComplexity text shapes", () => {
  it("ignores carriage returns of Windows line endings", () => {
    expect(measureComplexity("a\r\n  b\r\n")).toStrictEqual({
      loc: 2,
      total: 1,
      mean: 0.5,
      max: 1,
    });
  });

  it("reports zero for text without code lines", () => {
    expect(measureComplexity("\n  \n")).toStrictEqual({
      loc: 0,
      total: 0,
      mean: 0,
      max: 0,
    });
  });
});
