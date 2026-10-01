/**
 * Bundles the CLI, the engine, the viewer assets, and Effect into one minified
 * `dist/codeheat.js`, so `npx codeheat` never depends on how a consumer's
 * package manager resolves Effect's peer ranges. Only Node built-ins and
 * `oxc-parser`, the package's one runtime dependency, stay external: the
 * parser is a native module with a binary per platform, which cannot be
 * bundled. `scripts/verify-bundle-externals.mjs` enforces that.
 */
import { chmod } from "node:fs/promises";
import path from "node:path";

import { rolldown } from "rolldown";

const packageRoot = path.resolve(import.meta.dirname, "..");
const outfile = path.join(packageRoot, "dist/codeheat.js");

const bundle = await rolldown({
  input: path.join(packageRoot, "src/bin.ts"),
  platform: "node",
  external: ["oxc-parser"],
});
try {
  await bundle.write({ file: outfile, format: "esm", minify: true });
} finally {
  await bundle.close();
}
await chmod(outfile, 0o755);
console.log(`Built ${path.relative(packageRoot, outfile)}.`);
