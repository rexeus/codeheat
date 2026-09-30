import { describe, expect, it } from "vitest";

import { coupling } from "../testing/reports.js";
import { highlightOf, selectionOf } from "./highlight.js";
import { indexPartners } from "./partners.js";

const index = indexPartners([
  coupling("src/tax.ts", "src/tax.test.ts"),
  coupling("src/tax.ts", "web/checkout.ts"),
  coupling("web/cart.ts", "src/tax.ts"),
]);

const endsWithTs = (path: string): boolean => path.endsWith(".ts");

describe("highlightOf", () => {
  const selection = selectionOf("src/tax.ts", index);
  const nothing = null;

  it("lights the selected file and its partners and dims everything else", () => {
    expect(highlightOf("src/tax.ts", selection, nothing)).toBe("selected");
    expect(highlightOf("web/cart.ts", selection, nothing)).toBe("partner");
    expect(highlightOf("web/other.ts", selection, nothing)).toBe("dimmed");
  });

  it("dims a tile that stands for several files while a file is selected", () => {
    expect(highlightOf(null, selection, nothing)).toBe("dimmed");
  });

  it("lets a selection outrank the filter", () => {
    expect(highlightOf("web/other.ts", selection, () => true)).toBe("dimmed");
  });

  it("highlights filter matches and dims the rest when nothing is selected", () => {
    expect(highlightOf("a.ts", nothing, endsWithTs)).toBe("match");
    expect(highlightOf("a.css", nothing, endsWithTs)).toBe("dimmed");
    expect(highlightOf(null, nothing, endsWithTs)).toBe("dimmed");
  });

  it("leaves every tile alone without a selection or a filter", () => {
    expect(highlightOf("a.ts", nothing, nothing)).toBe("none");
  });

  it("selects a file with no partners without lighting anything else", () => {
    const lonely = selectionOf("src/other.ts", index);

    expect(highlightOf("src/other.ts", lonely, nothing)).toBe("selected");
    expect(highlightOf("src/tax.ts", lonely, nothing)).toBe("dimmed");
  });
});
