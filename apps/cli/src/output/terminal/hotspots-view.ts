// Owns the hotspot table of the `analyze` view: rank, score, revisions, complexity, path.
import type { FileStats } from "@codeheat/engine";

import { escapeForTerminal } from "../escape.js";
import { weightLabel } from "./format.js";
import type { Style } from "./style.js";
import { plain, renderTable } from "./table.js";

const TOP_HOTSPOTS = 10;
const BAR_WIDTH = 10;

const scoreBar = (score: number): string => {
  const filled = Math.round(score * BAR_WIDTH);
  return "█".repeat(filled) + "░".repeat(BAR_WIDTH - filled);
};

/**
 * The ten hottest files. Weighted, the revisions column also shows the
 * revisions at their recency weights in parentheses, since the score follows
 * those; unweighted, the column is the plain count.
 */
export const hotspotLines = (
  files: ReadonlyArray<FileStats>,
  weighted: boolean,
  style: Style,
): ReadonlyArray<string> =>
  renderTable(
    [
      { header: "rank", align: "right" },
      { header: "score", align: "left" },
      { header: weighted ? "revisions (recent)" : "revisions", align: "right" },
      { header: "complexity", align: "right" },
      { header: "path", align: "left" },
    ],
    files.slice(0, TOP_HOTSPOTS).map((file) => [
      plain(`#${file.rank}`),
      {
        text: `${scoreBar(file.score)} ${file.score.toFixed(2)}`,
        paint: (text) => style.heat(file.score, text),
      },
      plain(
        weighted
          ? `${file.revisions} (${weightLabel(file.weightedRevisions)})`
          : String(file.revisions),
      ),
      plain(String(file.complexity.total)),
      plain(escapeForTerminal(file.path)),
    ]),
    style,
  );
