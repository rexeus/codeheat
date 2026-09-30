import { describe, expect, it } from "vitest";

import { createPathMatcher } from "./filter.js";
import type { PathMatcher } from "./filter.js";

const paths = [
  "packages/billing/src/invoice.ts",
  "packages/billing/src/invoice.test.ts",
  "packages/web/src/routes/Invoices.tsx",
  "packages/web/src/[id]/page.tsx",
  ".github/workflows/ci.yml",
];
const matching = (matcher: PathMatcher | null): string[] => {
  if (matcher === null) {
    throw new Error("expected a matcher");
  }
  return paths.filter((path) => matcher(path));
};

describe("createPathMatcher", () => {
  it("matches nothing to filter for empty or blank input", () => {
    expect(createPathMatcher("")).toBeNull();
    expect(createPathMatcher("   ")).toBeNull();
  });

  it("matches plain text as a case-insensitive substring", () => {
    expect(matching(createPathMatcher("invoice"))).toEqual([
      "packages/billing/src/invoice.ts",
      "packages/billing/src/invoice.test.ts",
      "packages/web/src/routes/Invoices.tsx",
    ]);
  });

  it("treats dots and slashes in plain text literally", () => {
    expect(matching(createPathMatcher("src/invoice.ts"))).toEqual([
      "packages/billing/src/invoice.ts",
    ]);
  });

  it("matches a glob against the whole path", () => {
    expect(
      matching(createPathMatcher("packages/billing/**/*.test.ts")),
    ).toEqual(["packages/billing/src/invoice.test.ts"]);
  });

  it("matches a glob without a slash against the file name at any depth", () => {
    expect(matching(createPathMatcher("*.tsx"))).toEqual([
      "packages/web/src/routes/Invoices.tsx",
      "packages/web/src/[id]/page.tsx",
    ]);
  });

  it("supports braces and negation", () => {
    expect(matching(createPathMatcher("*.{yml,tsx}"))).toEqual([
      "packages/web/src/routes/Invoices.tsx",
      "packages/web/src/[id]/page.tsx",
      ".github/workflows/ci.yml",
    ]);
    expect(matching(createPathMatcher("!*.test.ts"))).not.toContain(
      "packages/billing/src/invoice.test.ts",
    );
  });

  it("matches dot directories with a glob", () => {
    expect(matching(createPathMatcher(".github/**"))).toEqual([
      ".github/workflows/ci.yml",
    ]);
  });
});
