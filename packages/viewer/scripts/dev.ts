/**
 * Writes the viewer page for a report and prints its file URL, so the page can
 * be opened in a browser. Usage: `pnpm --filter @codeheat/viewer dev [report.json]`;
 * the default is `fixtures/report.sample.json`. Run the build first (the `dev`
 * script does).
 */
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { parseReport } from "../src/document/embedded-report.js";
import { renderReportHtml } from "../src/index.js";

const repositoryRoot = path.resolve(import.meta.dirname, "../../..");
const reportPath = path.resolve(
  process.argv[2] ?? path.join(repositoryRoot, "fixtures/report.sample.json"),
);

const report = parseReport(await readFile(reportPath, "utf8"));
const outputPath = path.join(
  await mkdtemp(path.join(tmpdir(), "codeheat-viewer-")),
  "report.html",
);
await writeFile(outputPath, renderReportHtml(report));
console.log(pathToFileURL(outputPath).href);
