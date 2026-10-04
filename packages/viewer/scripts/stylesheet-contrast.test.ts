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
  "src/hero/hero.css",
  "src/where-to-start/where-to-start.css",
  "src/territory-cards/territory-cards.css",
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
      "meets AA on cohesion step %i, which colors the fit map",
      (step) => {
        const fill = tokenOf(scheme, `cohesion-${step}`);
        const ink = tokenOf(scheme, `cohesion-ink-${step}`);

        expect(contrast(fill, ink)).toBeGreaterThanOrEqual(AA);
      },
    );

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
      "meets AA for %s text on the surface of a territory card and on the page behind a quiet one",
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
