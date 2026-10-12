import { describe, expect, it } from "vitest";

import { analysisRecord } from "../testing/analysis-record.js";
import { inspect } from "./inspect.js";

const report = analysisRecord({
  excludes: [
    { pattern: "**/*.test.*", source: "default", files: 1 },
    { pattern: "test/**", source: "user", files: 2 },
  ],
});

const TRACKED = ["src/a.test.ts", "test/b.ts", "test/c.test.ts", "src/app.ts"];

describe("inspect excluded files", () => {
  it("names the first pattern that left each matched file out, and lists no such file as unmatched", () => {
    const result = inspect(
      report,
      ["src/a.test.ts", "test/*.ts", "src/none.ts"],
      TRACKED,
    );

    expect(result.matches).toStrictEqual([]);
    expect(result.excluded).toStrictEqual([
      { path: "src/a.test.ts", pattern: "**/*.test.*", source: "default" },
      { path: "test/b.ts", pattern: "test/**", source: "user" },
      { path: "test/c.test.ts", pattern: "**/*.test.*", source: "default" },
    ]);
    expect(result.unmatched).toStrictEqual(["src/none.ts"]);
  });

  it("lists no file that is not tracked, whatever pattern matches it", () => {
    const result = inspect(report, ["test/gone.ts"], TRACKED);

    expect(result.excluded).toStrictEqual([]);
    expect(result.unmatched).toStrictEqual(["test/gone.ts"]);
  });
});
