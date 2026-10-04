import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

// The tile text colors are tokens in the stylesheets the page inlines. They
// are read from source in the build's cascade order (`STYLESHEETS` in
// build.ts) and minified the same way, so the test needs no build; it guards
// that every pair of fill and ink meets WCAG AA (4.5:1) in both color schemes.
const STYLESHEETS = [
  "src/document/styles.css",
  "src/document/page.css",
  "src/answers/answers.css",
  "src/map-grouping/map-grouping.css",
] as const;

const packageRoot = path.resolve(import.meta.dirname, "..");
const css = STYLESHEETS.map((file) =>
  readFileSync(path.join(packageRoot, file), "utf8"),
)
  .join("\n")
  .replaceAll(/\/\*[\s\S]*?\*\//gu, "")
  .replaceAll(/\s+/gu, " ");
const darkStart = css.indexOf("@media (prefers-color-scheme: dark)");
const schemes = {
  light: css.slice(css.indexOf(":root {"), darkStart),
  dark: css.slice(darkStart, css.indexOf('[data-step="0"]')),
} as const;

type Scheme = keyof typeof schemes;

/** The value of a custom property in a scheme, following `var(--other)` and falling back to the light scheme. */
const tokenOf = (scheme: Scheme, name: string): string => {
  for (const block of [schemes[scheme], schemes.light]) {
    const value = new RegExp(`--${name}:\\s*([^;]+);`, "u").exec(block)?.[1];
    if (value !== undefined) {
      const reference = /^var\(--([\w-]+)\)$/u.exec(value.trim())?.[1];
      return reference === undefined
        ? value.trim()
        : tokenOf(scheme, reference);
    }
  }
  throw new Error(`no token --${name}`);
};

const channel = (hex: string, offset: number): number => {
  const value = Number.parseInt(hex.slice(offset, offset + 2), 16) / 255;
  return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
};

const luminance = (hex: string): number =>
  0.2126 * channel(hex, 1) +
  0.7152 * channel(hex, 3) +
  0.0722 * channel(hex, 5);

const contrast = (one: string, other: string): number => {
  const [light = 0, dark = 0] = [luminance(one), luminance(other)].toSorted(
    (left, right) => right - left,
  );
  return (light + 0.05) / (dark + 0.05);
};

const AA = 4.5;

describe.each(["light", "dark"] as const)(
  "text on a tile in %s mode",
  (scheme) => {
    it.each([1, 2, 3, 4, 5, 6])(
      "meets AA on cohesion step %i, which colors a tile in the map's cohesion mode",
      (step) => {
        const fill = tokenOf(scheme, `cohesion-${step}`);
        const ink = tokenOf(scheme, `cohesion-ink-${step}`);

        expect(contrast(fill, ink)).toBeGreaterThanOrEqual(AA);
      },
    );

    it.each(["strained", "mixed", "holds", "unknown"])(
      "meets AA on the %s verdict badge",
      (level) => {
        const fill = tokenOf(scheme, `verdict-${level}`);
        const ink = tokenOf(scheme, `verdict-${level}-ink`);

        expect(contrast(fill, ink)).toBeGreaterThanOrEqual(AA);
      },
    );

    it.each(["boundary", "hotspot", "coupling", "hub", "copies", "clique"])(
      "meets AA on the chip of a %s place to start",
      (kind) => {
        const fill = tokenOf(scheme, `kind-${kind}`);
        const ink = tokenOf(scheme, `kind-${kind}-ink`);

        expect(contrast(fill, ink)).toBeGreaterThanOrEqual(AA);
      },
    );

    it.each(["leak-ink", "hold-ink", "effort"])(
      "meets AA for %s numbers and words on the surface of a card",
      (ink) => {
        expect(
          contrast(tokenOf(scheme, ink), tokenOf(scheme, "surface")),
        ).toBeGreaterThanOrEqual(AA);
      },
    );

    it("meets AA for the leaks label on the zone it names", () => {
      expect(
        contrast(tokenOf(scheme, "leak-ink"), tokenOf(scheme, "leak-zone")),
      ).toBeGreaterThanOrEqual(AA);
    });

    it("meets AA on the no-data tile", () => {
      expect(
        contrast(tokenOf(scheme, "heat-0"), tokenOf(scheme, "ink-0")),
      ).toBeGreaterThanOrEqual(AA);
    });

    it("meets AA on the rank marker", () => {
      expect(
        contrast(tokenOf(scheme, "marker"), tokenOf(scheme, "marker-ink")),
      ).toBeGreaterThanOrEqual(AA);
    });

    it.each(["text", "text-2", "muted", "eyebrow", "hidden-coupling"])(
      "meets AA for %s text on the surface of a card and on the page",
      (ink) => {
        for (const ground of ["surface", "page"]) {
          expect(
            contrast(tokenOf(scheme, ink), tokenOf(scheme, ground)),
          ).toBeGreaterThanOrEqual(AA);
        }
      },
    );
  },
);

/** The declarations of the first rule whose selector is exactly `selector`. */
const declarationsOf = (selector: string): string => {
  const rule = new RegExp(
    `(?:^|\\})\\s*${selector.replaceAll(".", "\\.")}\\s*\\{([^}]*)\\}`,
    "u",
  ).exec(css);
  if (rule?.[1] === undefined) {
    throw new Error(`no rule for ${selector}`);
  }
  return rule[1];
};

/** The value a rule declares for a property, with a `var(--token)` followed to the color it names in `scheme`. */
const resolvedDeclaration = (
  scheme: Scheme,
  selector: string,
  property: string,
): string | undefined => {
  const value = new RegExp(`(?:^|[;\\s])${property}:\\s*([^;]+);`, "u")
    .exec(declarationsOf(selector))?.[1]
    ?.trim();
  const reference = /^var\(--([\w-]+)\)$/u.exec(value ?? "")?.[1];
  return reference === undefined ? value : tokenOf(scheme, reference);
};

describe("the sticky bar", () => {
  it.each(["light", "dark"] as const)(
    "is painted with the opaque page color in %s mode, so scrolled content never shows through",
    (scheme) => {
      const background = resolvedDeclaration(scheme, ".topbar", "background");

      expect(background).toBe(tokenOf(scheme, "page"));
      expect(background).toMatch(/^#[\da-f]{6}$/u);
      expect(declarationsOf(".topbar")).not.toContain("backdrop-filter");
    },
  );

  it.each(["light", "dark"] as const)(
    "keeps its link text readable on the page color in %s mode",
    (scheme) => {
      for (const ink of ["text", "text-2"]) {
        expect(
          contrast(tokenOf(scheme, ink), tokenOf(scheme, "page")),
        ).toBeGreaterThanOrEqual(AA);
      }
    },
  );
});
