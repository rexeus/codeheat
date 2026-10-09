import { describe, expect, it } from "vitest";

import { mainFiles, tidy } from "./description-text.js";
import type { TerritoryFile } from "./node-measures.js";

describe("tidy", () => {
  it("turns control characters and line breaks into single spaces and drops invisible format characters", () => {
    expect(tidy("Billing\u001B[31m\n\tand\u202E  tax\u0000 ")).toBe(
      "Billing [31m and tax",
    );
  });

  it("cuts a long text at a word with an ellipsis", () => {
    const tidied = tidy("word ".repeat(80));

    expect(Array.from(tidied)).toHaveLength(155);
    expect(tidied.endsWith("word…")).toBe(true);
  });
});

const entry = (path: string, changes: number, loc = 10): TerritoryFile => ({
  path,
  loc,
  complexity: { total: 0 },
  changes,
});

describe("mainFiles", () => {
  const files = new Map(
    [
      entry("billing/invoice.ts", 9),
      entry("billing/tax.ts", 5, 100),
      entry("billing/discount.ts", 5, 20),
      entry("billing/index.ts", 4),
    ].map((file) => [file.path, file]),
  );

  it("names the three most changed files, ties by size", () => {
    expect(mainFiles([...files.keys()], files)).toBe(
      "main files: invoice, tax, discount",
    );
  });

  it("names the folder with a file name that says nothing on its own", () => {
    expect(mainFiles(["billing/index.ts"], files)).toBe(
      "main files: billing/index",
    );
  });

  it("says nothing for no files", () => {
    expect(mainFiles([], files)).toBe("");
  });
});
