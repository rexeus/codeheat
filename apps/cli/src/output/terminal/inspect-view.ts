// Owns the human view of `inspect`: each focused file with its standing and partners.
import type { InspectResult, Module } from "@codeheat/engine";

import { escapeForTerminal } from "../escape.js";
import { describeDepth } from "./depth-view.js";
import { day, percent, twoDecimals } from "./format.js";
import type { Style } from "./style.js";
import { plain, renderTable } from "./table.js";
import type { Cell } from "./table.js";

type Entry = InspectResult["matches"][number];

const partnerMarker = (partner: Entry["partners"][number]): string => {
  if (partner.testPair) {
    return " (test)";
  }
  return partner.crossesModule ? " (other module)" : "";
};

type PartnerImports = NonNullable<Entry["partners"][number]["imports"]>;

const IMPORT_LABELS: Readonly<Record<PartnerImports, string>> = {
  "file→partner": "imports",
  "partner→file": "imported by",
  both: "both",
  none: "hidden",
};

/**
 * What the inspected file does with its partner. No import at all is hidden
 * coupling, which stands out; for the file's test it is just "none", since a
 * test is expected to be coupled.
 */
const importsCell = (
  { imports, testPair }: Entry["partners"][number],
  style: Style,
): Cell => {
  if (imports === null) {
    return plain("-");
  }
  if (imports === "none") {
    return testPair
      ? plain("none")
      : { text: IMPORT_LABELS[imports], paint: style.bold };
  }
  return plain(IMPORT_LABELS[imports]);
};

const partnerLines = (entry: Entry, style: Style): ReadonlyArray<string> =>
  entry.partners.length === 0
    ? ["No change coupling above the thresholds."]
    : renderTable(
        [
          { header: "co-change", align: "right" },
          { header: "shared", align: "right" },
          { header: "import", align: "left" },
          { header: "partner", align: "left" },
        ],
        entry.partners.map((partner) => [
          plain(percent(partner.probability)),
          plain(String(partner.sharedCommits)),
          importsCell(partner, style),
          plain(escapeForTerminal(partner.path) + partnerMarker(partner)),
        ]),
        style,
      );

/** The module's depth on one line; nothing when it could not be measured. */
const depthLine = (module: Module): ReadonlyArray<string> =>
  module.depth === null
    ? []
    : [
        `module ${escapeForTerminal(module.path)} depth: ${describeDepth(module.depth)}`,
      ];

/** Where a change to the file lands: how often its module's changes stay inside it, and what they pull in. */
const moduleLine = (module: Module | undefined): ReadonlyArray<string> => {
  if (module === undefined) {
    return [];
  }
  const name = `module ${escapeForTerminal(module.path)}`;
  if (module.cohesion === null) {
    return [`${name}: no counted commits`, ...depthLine(module)];
  }
  const [partner] = module.partners;
  const partnerNote =
    partner === undefined
      ? ""
      : `, most often with ${escapeForTerminal(partner.path)} (${partner.sharedCommits})`;
  return [
    `${name}: ${percent(module.cohesion)} of ${module.commits} commits stay inside${partnerNote}`,
    ...depthLine(module),
  ];
};

const entryLines = (
  entry: Entry,
  modules: ReadonlyArray<Module>,
  style: Style,
): ReadonlyArray<string> => [
  style.bold(escapeForTerminal(entry.path)),
  `rank #${entry.rank} of ${entry.of}, score ${entry.score.toFixed(2)}`,
  `${entry.revisions} revisions, ${entry.breadth} co-changed files, +${entry.linesAdded} -${entry.linesDeleted} lines, ${entry.loc} loc`,
  `indentation complexity ${entry.complexity.total} (mean ${twoDecimals(entry.complexity.mean)}, max ${entry.complexity.max})`,
  ...moduleLine(modules.find(({ path }) => path === entry.module)),
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
    ...result.matches.flatMap((entry) => [
      "",
      ...entryLines(entry, result.modules, style),
    ]),
  ].join("\n");
