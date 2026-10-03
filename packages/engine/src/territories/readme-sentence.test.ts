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

describe("readmeSentence on hostile input", () => {
  it.each([
    ["square brackets", "[".repeat(262_144)],
    ["image openers", "![".repeat(131_072)],
    ["angle brackets", "<".repeat(262_144)],
    ["link openers", "[a](".repeat(65_536)],
  ])("finishes quickly on a README of %s", (_name, readme) => {
    const start = performance.now();

    const sentence = readmeSentence(readme);

    expect(performance.now() - start).toBeLessThan(250);
    expect(sentence).toBe(undefined);
  });

  it("finishes quickly on a README of one endless paragraph", () => {
    const start = performance.now();

    const sentence = readmeSentence("word ".repeat(100_000));

    expect(performance.now() - start).toBeLessThan(250);
    expect(sentence?.length).toBeLessThanOrEqual(2048);
  });
});
