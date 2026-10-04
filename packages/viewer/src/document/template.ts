import type { Report } from "@codeheat/engine";

import { viewerScript, viewerStyles } from "../../dist/assets.js";
import { REPORT_ELEMENT_ID, serializeReport } from "./embedded-report.js";
import { PAGE_BODY } from "./page-body.js";

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
${PAGE_BODY}
<script type="application/json" id="${REPORT_ELEMENT_ID}">${serializeReport(report)}</script>
<script>${viewerScript}</script>
</body>
</html>
`;
