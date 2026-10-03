import { describe, expect, it } from "vitest";

import {
  mainFiles,
  manifestDescription,
  readmeSentence,
  tidy,
} from "./description-text.js";
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

describe("manifestDescription", () => {
  it("reads the description of the manifests that declare one", () => {
    expect([
      manifestDescription("package.json", '{ "description": "Invoices." }'),
      manifestDescription(
        "Cargo.toml",
        '[package]\nname = "x"\ndescription = "Fast \\"parser\\"."\n',
      ),
      manifestDescription(
        "pyproject.toml",
        "[project]\ndescription = 'Tax rules'\n",
      ),
      manifestDescription(
        "pom.xml",
        "<project><description>Billing</description></project>",
      ),
    ]).toStrictEqual(["Invoices.", 'Fast "parser".', "Tax rules", "Billing"]);
  });

  it("reads nothing from a malformed manifest or a description that is not text", () => {
    expect([
      manifestDescription("package.json", "{ nope"),
      manifestDescription("package.json", '{ "description": 3 }'),
      manifestDescription("package.json", "[]"),
      manifestDescription("go.mod", "module x"),
    ]).toStrictEqual([undefined, undefined, undefined, undefined]);
  });
});

describe("readmeSentence", () => {
  it("takes the first sentence of the first paragraph of prose", () => {
    const readme = [
      "# billing",
      "",
      "[![build](https://ci/badge.svg)](https://ci) ![logo](logo.png)",
      "",
      "```sh",
      "npm install",
      "```",
      "",
      "Creates **invoices** and applies [tax rules](docs/tax.md) per country. It also",
      "sends reminders.",
    ].join("\n");

    expect(readmeSentence(readme)).toBe(
      "Creates invoices and applies tax rules per country.",
    );
  });

  it("skips front matter, headings with underlines, lists, and tables", () => {
    const readme = [
      "---",
      "title: x",
      "---",
      "Billing",
      "=======",
      "",
      "- one",
      "- two",
      "",
      "| a | b |",
      "",
      "Installation:",
      "",
      "Everything about invoices, without a full stop",
    ].join("\n");

    expect(readmeSentence(readme)).toBe(
      "Everything about invoices, without a full stop",
    );
  });

  it("does not end a sentence at an abbreviation", () => {
    expect(
      readmeSentence("Handles e.g. VAT and sales tax. Second sentence."),
    ).toBe("Handles e.g. VAT and sales tax.");
  });

  it("passes over a label and a sentence that introduces a list", () => {
    expect(
      readmeSentence("Usage:\n\nRun the setup in this order:\n\n1. one\n"),
    ).toBe(undefined);
  });

  it("finds nothing in a README without prose", () => {
    expect(readmeSentence("# title\n\n![badge](x.svg)\n\n- item\n")).toBe(
      undefined,
    );
  });
});

const entry = (path: string, changes: number, loc = 10): TerritoryFile => ({
  path,
  loc,
  complexity: { total: 0 },
  changes,
  test: path.includes(".test."),
});

describe("mainFiles", () => {
  const files = new Map(
    [
      entry("billing/invoice.ts", 9),
      entry("billing/tax.ts", 5, 100),
      entry("billing/discount.ts", 5, 20),
      entry("billing/index.ts", 4),
      entry("billing/invoice.test.ts", 30),
    ].map((file) => [file.path, file]),
  );

  it("names the three most changed files, tests left out, ties by size", () => {
    expect(mainFiles([...files.keys()], files)).toBe(
      "main files: invoice, tax, discount",
    );
  });

  it("names the folder with a file name that says nothing on its own", () => {
    expect(
      mainFiles(["billing/index.ts", "billing/invoice.test.ts"], files),
    ).toBe("main files: billing/index");
  });

  it("names tests when there is nothing else", () => {
    expect(mainFiles(["billing/invoice.test.ts"], files)).toBe(
      "main files: invoice.test",
    );
  });

  it("says nothing for no files", () => {
    expect(mainFiles([], files)).toBe("");
  });
});
