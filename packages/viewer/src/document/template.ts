import type { Report } from "@codeheat/engine";

import { viewerScript, viewerStyles } from "../../dist/assets.js";
import { REPORT_ELEMENT_ID, serializeReport } from "./embedded-report.js";

const escapeHtmlText = (text: string): string =>
  text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

/**
 * The complete viewer page for `report`, as one self-contained HTML document:
 * styles, script and data are inline, and nothing loads from the network.
 * The report is embedded whole; the page renders every path as text.
 */
export const renderReportHtml = (report: Report): string => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<link rel="icon" href="data:,">
<title>codeheat · ${escapeHtmlText(report.repository.name)}</title>
<style>${viewerStyles}</style>
</head>
<body>
<div id="app" class="app" data-mode="heat">
  <header class="header">
    <div class="heading">
      <h1 id="repository"></h1>
      <p id="summary"></p>
    </div>
    <div id="legend" class="legend"></div>
  </header>
  <div class="toolbar">
    <fieldset id="mode-switch" class="mode-switch">
      <legend>Color by</legend>
      <label><input type="radio" name="color-mode" value="heat" checked><span>Heat</span></label>
      <label><input type="radio" name="color-mode" value="cohesion"><span>Cohesion</span></label>
      <label><input type="radio" name="color-mode" value="change"><span>Change</span></label>
    </fieldset>
    <input id="filter" type="search" autocomplete="off" spellcheck="false" aria-label="Filter files" placeholder="Filter by path or glob, e.g. billing or src/**/*.ts">
    <span id="filter-count" class="filter-count"></span>
  </div>
  <main class="content">
    <div id="stage" class="stage">
      <svg id="treemap" role="img" aria-label="Treemap of files: area is lines of code, color is hotspot score, module cohesion, or change since the previous window"></svg>
      <div id="tooltip" class="tooltip" hidden></div>
    </div>
    <aside id="panel" class="panel" aria-live="polite"></aside>
  </main>
</div>
<script type="application/json" id="${REPORT_ELEMENT_ID}">${serializeReport(report)}</script>
<script>${viewerScript}</script>
</body>
</html>
`;
