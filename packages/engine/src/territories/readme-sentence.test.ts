import { describe, expect, it } from "vitest";

import { readmeSentence } from "./readme-sentence.js";

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

describe("readmeSentence past badges and directives", () => {
  it("passes over rows of badges, inline and by reference", () => {
    const readme = [
      "[![npm][npm-badge]][npm-url] [![ci][ci-badge]][ci-url]",
      "[![npm](https://img/npm.svg)](https://npm) [![ci](https://img/ci.svg)](https://ci)",
      "",
      "[npm-badge]: https://img/npm.svg",
      "[npm-url]: https://npm",
      "",
      "A small library for money arithmetic.",
    ].join("\n");

    expect(readmeSentence(readme)).toBe(
      "A small library for money arithmetic.",
    );
  });

  it("passes over a paragraph of nothing but links", () => {
    expect(
      readmeSentence(
        "[Docs](https://docs) | [API](https://api) | [Changelog](CHANGELOG.md)\n\nTax rules for every country we sell to.",
      ),
    ).toBe("Tax rules for every country we sell to.");
  });

  it("passes over reStructuredText directives and fields", () => {
    const readme = [
      "======",
      "money",
      "======",
      "",
      ".. image:: https://img/ci.svg",
      "   :target: https://ci",
      "   :alt: build",
      "",
      ".. contents::",
      "",
      "Money arithmetic without rounding surprises.",
    ].join("\n");

    expect(readmeSentence(readme)).toBe(
      "Money arithmetic without rounding surprises.",
    );
  });

  it("passes over indented code", () => {
    expect(
      readmeSentence("    npm install money\n\nMoney arithmetic for the shop."),
    ).toBe("Money arithmetic for the shop.");
  });

  it("finds nothing when no alphabetic word is left", () => {
    expect(readmeSentence("1234 5678 9012 ...")).toBe(undefined);
  });
});

describe("readmeSentence on instructions", () => {
  it.each([
    ["See", "See the docs folder for an example of the setup."],
    ["After", "After installing the tools, the settings file should exist."],
    ["Run", "Run the migration before you start the service."],
    ["To", "To use the client, create it with your token."],
    ["Before", "Before you begin, install the toolchain."],
    ["Note:", "Note: this package is not published yet."],
    ["Note that", "Note that the client needs a token."],
    ["Make sure", "Make sure the database is running first."],
    ["Please", "Please read the contributing guide."],
    ["Refer to", "Refer to the wiki for the details."],
    ["a lower case opening", "see the docs folder for an example."],
  ])("passes over a sentence that opens with %s", (_name, sentence) => {
    expect(readmeSentence(sentence)).toBe(undefined);
  });

  it.each([
    "Creates the audit entries described in src/audit/trace.ts.",
    "The request helper lives in src/helper.ts and prints requests.",
    "Config comes from ./config/default.json at startup.",
  ])("passes over a sentence that names a file path: %s", (sentence) => {
    expect(readmeSentence(sentence)).toBe(undefined);
  });

  it("takes the next paragraph of prose in place of an instruction", () => {
    const readme = [
      "# api",
      "",
      "See apps/web/src/example.ts for a usage example.",
      "",
      "Serves the public REST API of the shop.",
    ].join("\n");

    expect(readmeSentence(readme)).toBe(
      "Serves the public REST API of the shop.",
    );
  });

  it("keeps a sentence that merely contains an instruction word, a slash, or a dot", () => {
    expect(
      readmeSentence("Runs the nightly import of CI/CD data, v1.2 and I/O."),
    ).toBe("Runs the nightly import of CI/CD data, v1.2 and I/O.");
    expect(readmeSentence("Run-time checks for the billing service.")).toBe(
      "Run-time checks for the billing service.",
    );
    expect(readmeSentence("Tokens and sessions for the web shop.")).toBe(
      "Tokens and sessions for the web shop.",
    );
  });

  it("finishes quickly on a paragraph of slashes and dots", () => {
    const start = performance.now();

    readmeSentence("a/b.".repeat(512));
    readmeSentence(`${"a.".repeat(1024)} sentence of words`);

    expect(performance.now() - start).toBeLessThan(2000);
  });
});

describe("readmeSentence on hostile input", () => {
  it.each([
    ["square brackets", "[".repeat(262_144)],
    ["image openers", "![".repeat(131_072)],
    ["angle brackets", "<".repeat(262_144)],
    ["link openers", "[a](".repeat(65_536)],
  ])("finishes quickly on a README of %s", (_name, readme) => {
    const start = performance.now();

    const sentence = readmeSentence(readme);

    expect(performance.now() - start).toBeLessThan(2000);
    expect(sentence).toBe(undefined);
  });

  it("finishes quickly on a README of many paragraphs of openers", () => {
    const readme = Array.from({ length: 120 }, () => "![".repeat(1024)).join(
      "\n\n",
    );
    const start = performance.now();

    const sentence = readmeSentence(readme);

    expect(performance.now() - start).toBeLessThan(2000);
    expect(sentence).toBe(undefined);
  });

  it("finishes quickly on a README of one endless paragraph", () => {
    const start = performance.now();

    const sentence = readmeSentence("word ".repeat(100_000));

    expect(performance.now() - start).toBeLessThan(2000);
    expect(sentence?.length).toBeLessThanOrEqual(2048);
  });
});
