// Owns the human view of `inspect`: each focused file with its standing and partners.
import type { InspectResult } from "@codeheat/engine";

import { escapeForTerminal } from "../escape.js";
import { day, percent } from "./format.js";
import type { Style } from "./style.js";
import { plain, renderTable } from "./table.js";

type Entry = InspectResult["matches"][number];

const partnerLines = (entry: Entry, style: Style): ReadonlyArray<string> =>
  entry.partners.length === 0
    ? ["No change coupling above the thresholds."]
    : renderTable(
        [
          { header: "co-change", align: "right" },
          { header: "shared", align: "right" },
          { header: "partner", align: "left" },
        ],
        entry.partners.map((partner) => [
          plain(percent(partner.probability)),
          plain(String(partner.sharedCommits)),
          plain(
            escapeForTerminal(partner.path) +
              (partner.testPair ? " (test)" : ""),
          ),
        ]),
        style,
      );

const entryLines = (entry: Entry, style: Style): ReadonlyArray<string> => [
  style.bold(escapeForTerminal(entry.path)),
  `rank #${entry.rank} of ${entry.of}, score ${entry.score.toFixed(2)}`,
  `${entry.revisions} revisions, +${entry.linesAdded} -${entry.linesDeleted} lines, ${entry.loc} loc`,
  `indentation complexity ${entry.complexity.total} (mean ${entry.complexity.mean}, max ${entry.complexity.max})`,
  ...entry.reasons.map((reason) => `- ${escapeForTerminal(reason)}`),
  "",
  style.bold("Changes together with"),
  ...partnerLines(entry, style),
];

/**
 * Renders the terminal view of an `inspect` result: one block per matched
 * file, sorted as given. Unmatched patterns are not part of this view; the
 * caller reports them as diagnostics. The result has no trailing newline.
 */
export const renderInspect = (result: InspectResult, style: Style): string =>
  [
    style.dim(`${day(result.window.since)} to ${day(result.window.until)}`),
    ...result.matches.flatMap((entry) => ["", ...entryLines(entry, style)]),
  ].join("\n");
