// Owns the terminal view of copy families: files with largely the same content that change in lockstep.
import type { InspectResult, Analysis } from "@codeheat/engine";

import { escapeForTerminal } from "../escape.js";
import { percent } from "./format.js";
import type { Style } from "./style.js";
import { plain, renderTable } from "./table.js";

type Family = Analysis["copyFamilies"][number];

const TOP_FAMILIES = 5;
const SHOWN_FILES = 3;

/** `62%`, or `55-70%` when the family's pairs differ in how alike they are. */
const similarityNote = ({ min, max }: Family["similarity"]): string =>
  percent(min) === percent(max)
    ? percent(max)
    : `${percent(min).slice(0, -1)}-${percent(max)}`;

const pathNote = (files: ReadonlyArray<string>): string => {
  const shown = files
    .slice(0, SHOWN_FILES)
    .map((file) => escapeForTerminal(file));
  const hidden = files.length - shown.length;
  return hidden > 0 ? `${shown.join(", ")} +${hidden} more` : shown.join(", ");
};

const familyRows = (
  families: ReadonlyArray<Family>,
  style: Style,
): ReadonlyArray<string> => [
  ...renderTable(
    [
      { header: "copies", align: "right" },
      { header: "similar", align: "right" },
      { header: "shared", align: "right" },
      { header: "all", align: "right" },
      { header: "files", align: "left" },
    ],
    families
      .slice(0, TOP_FAMILIES)
      .map((family) => [
        plain(String(family.files.length)),
        plain(similarityNote(family.similarity)),
        plain(String(family.sharedChanges)),
        plain(String(family.changesToAll)),
        plain(pathNote(family.files)),
      ]),
    style,
  ),
  style.dim(
    "shared: changes that touched two or more copies; all: changes that touched every copy",
  ),
];

/**
 * The lines of the "Copies" section: a table of the five families with
 * production code that had the most changes touching every copy, with a note
 * on what its counts mean, and a note counting the families of test code only,
 * which the table leaves out (they stay in `--json`). None when the report has
 * no family.
 */
export const copyLines = (
  report: Analysis,
  style: Style,
): ReadonlyArray<string> => {
  const production = report.copyFamilies.filter(({ testOnly }) => !testOnly);
  const leftOut = report.copyFamilies.length - production.length;
  return [
    ...(production.length === 0 ? [] : familyRows(production, style)),
    ...(leftOut === 0
      ? []
      : [
          style.dim(
            `${leftOut === 1 ? "1 family" : `${leftOut} families`} of test code only left out; see copyFamilies in --json`,
          ),
        ]),
  ];
};

/**
 * The one-line note of an inspected file's copy family: how many copies it has
 * and which, and how often they changed together. Nothing for a file that is
 * no member.
 */
export const copyFamilyLine = (
  path: string,
  family: InspectResult["matches"][number]["copyFamily"],
): ReadonlyArray<string> => {
  if (family === null) {
    return [];
  }
  const copies = family.files.filter((file) => file !== path);
  const count = copies.length === 1 ? "1 copy" : `${copies.length} copies`;
  const touched =
    family.files.length === 2
      ? `${family.sharedChanges} changes touched both`
      : `${family.sharedChanges} changes touched at least two of the ${family.files.length} files, ${family.changesToAll} touched all of them`;
  return [
    `changes with its ${count}: ${copies.map((file) => escapeForTerminal(file)).join(", ")} (${touched})`,
  ];
};
