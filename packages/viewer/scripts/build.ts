/**
 * Bundles the browser entry into one minified IIFE and writes `dist/assets.js`,
 * which exports the script and the stylesheet as strings for `renderReportHtml`.
 * Inlining them keeps the report a single file and the CLI bundle free of
 * runtime file reads.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { rolldown } from "rolldown";

const packageRoot = path.resolve(import.meta.dirname, "..");
const distRoot = path.join(packageRoot, "dist");

const bundleScript = async (): Promise<string> => {
  const bundle = await rolldown({
    input: path.join(packageRoot, "src/main.ts"),
    platform: "browser",
  });
  try {
    const { output } = await bundle.generate({ format: "iife", minify: true });
    const [entry] = output;
    if (entry === undefined) {
      throw new Error("rolldown produced no output for src/main.ts.");
    }
    return entry.code;
  } finally {
    await bundle.close();
  }
};

/** The stylesheets in cascade order: tokens and the map first, then each section of the page. */
const STYLESHEETS = [
  "src/document/styles.css",
  "src/document/page.css",
  "src/hero/hero.css",
  "src/where-to-start/where-to-start.css",
  "src/territory-cards/territory-cards.css",
  "src/together/together.css",
] as const;

const minifyStyles = async (): Promise<string> => {
  const sources = await Promise.all(
    STYLESHEETS.map((file) => readFile(path.join(packageRoot, file), "utf8")),
  );
  return sources
    .join("\n")
    .replaceAll(/\/\*[\s\S]*?\*\//gu, "")
    .replaceAll(/\s+/gu, " ")
    .trim();
};

/** Text that would end its inline element early must never reach the template. */
const assertInlineSafe = (
  name: string,
  text: string,
  closers: readonly RegExp[],
): void => {
  for (const closer of closers) {
    if (closer.test(text)) {
      throw new Error(
        `${name} contains ${closer}; it cannot be inlined into the page.`,
      );
    }
  }
};

const script = await bundleScript();
const styles = await minifyStyles();
assertInlineSafe("The viewer script", script, [/<\/script/iu, /<!--/u]);
assertInlineSafe("The viewer styles", styles, [/<\/style/iu]);

await mkdir(distRoot, { recursive: true });
await writeFile(
  path.join(distRoot, "assets.js"),
  `export const viewerScript = ${JSON.stringify(script)};\nexport const viewerStyles = ${JSON.stringify(styles)};\n`,
);
await writeFile(
  path.join(distRoot, "assets.d.ts"),
  "export declare const viewerScript: string;\nexport declare const viewerStyles: string;\n",
);
console.log(
  `Built dist/assets.js (${script.length} B script, ${styles.length} B styles).`,
);
