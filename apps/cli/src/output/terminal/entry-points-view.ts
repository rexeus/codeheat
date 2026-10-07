// Owns the terminal's answer to "where do I start": the ranked entry points
// with their verdict, their numbers in plain words, and the design move.
import type { Report } from "@codeheat/engine";

import { escapeForTerminal } from "../escape.js";
import { percent } from "./format.js";
import type { Style } from "./style.js";

type EntryPoint = Report["entryPoints"][number];
type Finding = EntryPoint["findings"][number];

const KIND_LABELS: Readonly<Record<EntryPoint["kind"], string>> = {
  boundary: "boundary",
  hotspot: "hotspot",
  clique: "unit",
  copies: "copies",
  hub: "hub",
  coupling: "coupling",
};

/** The count with its noun, the noun in the plural unless the count is 1. */
const counted = (count: number, noun: string): string =>
  `${count} ${count === 1 ? noun : `${noun}s`}`;

/** What the entry is about, as paths: its files when it names some, else its territories. */
const subject = (
  entry: EntryPoint,
  pathOf: ReadonlyMap<string, string>,
): string => {
  const names =
    entry.files.length > 0
      ? entry.files
      : entry.territories.map((id) => pathOf.get(id) ?? id);
  // a group territory's path is already one brace glob over its folders
  return names
    .map((name) => escapeForTerminal(name))
    .join(entry.kind === "coupling" ? " <-> " : ", ");
};

/** ` of <paths>` for a finding about other territories than its entry's own, else nothing. */
const concerning = (
  finding: Finding,
  entry: EntryPoint,
  pathOf: ReadonlyMap<string, string>,
): string =>
  finding.territories.length === entry.territories.length &&
  finding.territories.every((id) => entry.territories.includes(id))
    ? ""
    : ` of ${finding.territories.map((id) => escapeForTerminal(pathOf.get(id) ?? id)).join(", ")}`;

/** Whether `finding` is the boundary of one territory of an entry that is the boundary between two. */
const isPartOf = (finding: Finding, entry: EntryPoint): boolean =>
  entry.kind === "boundary" &&
  finding.kind === "boundary" &&
  finding.territories.length < entry.territories.length;

/** A number of the entry's evidence, 0 when the entry has none by that name. */
type Numbers = (name: string) => number;

const EVIDENCE_LINES: Readonly<
  Record<
    EntryPoint["kind"],
    (at: Numbers, evidence: EntryPoint["evidence"]) => string
  >
> = {
  boundary: (at, evidence) =>
    evidence["sharedChanges"] === undefined
      ? `${percent(at("codeHeatShare"))} of the code's heat; ${percent(at("containment"))} of its ${counted(at("changes"), "change")} stay inside${evidence["partnerShare"] === undefined ? "" : `, ${percent(at("partnerShare"))} also touch its closest partner`}`
      : `${percent(at("codeHeatShare"))} of the code's heat; ${percent(at("containment"))} of their ${counted(at("changes"), "change")} stay inside one of the two, ${counted(at("sharedChanges"), "change")} touched both`,
  hotspot: (at) =>
    `${percent(at("chronicHeatShare"))} of the code's heat sits in ${counted(at("chronicFiles"), "chronic hotspot")}`,
  clique: (at) =>
    `${percent(at("codeHeatShare"))} of the code's heat; ${counted(at("sharedChanges"), "change")} touched all ${at("territories")}, every pair shares at least ${percent(at("weakestShare"))}`,
  copies: (at) =>
    `${counted(at("files"), "file")}, at least ${percent(at("similarity"))} alike; ${counted(at("changesToAll"), "change")} touched every copy`,
  coupling: (at) =>
    `${counted(at("sharedChanges"), "change")} touched both, ${percent(at("degree"))} of the time either changes; no import links them`,
  hub: (at) =>
    `${counted(at("fanIn"), "file")} depend on it, ${at("changedDependents")} of them changed together with it; ${counted(at("changes"), "change")} touched it`,
};

/** The numbers behind the entry, in a sentence a newcomer can read. */
const evidenceLine = ({
  kind,
  evidence,
}: Pick<Finding, "kind" | "evidence">): string =>
  EVIDENCE_LINES[kind]((name) => evidence[name] ?? 0, evidence);

/**
 * The "Where to start" section: one block per entry point, best first, each
 * with its kind, what it is about (paths joined with `, `, the two files of a
 * coupling with `<->`), the verdict, the numbers, and the design move, then
 * the verdict, numbers, and move of each further finding of the entry under
 * "Also" (naming the territories of one that is about others than the entry); the paths are made safe to print. Empty when the report has no entry
 * points. A trailing blank line closes the section.
 */
export const entryPointLines = (
  { entryPoints, territories }: Pick<Report, "entryPoints" | "territories">,
  style: Style,
): ReadonlyArray<string> => {
  if (entryPoints.length === 0) {
    return [];
  }
  const pathOf = new Map(territories.nodes.map(({ id, path }) => [id, path]));
  const width = String(entryPoints.length).length;
  const indent = " ".repeat(width + 2);
  return [
    style.bold("Where to start"),
    ...entryPoints.flatMap((entry) => [
      `${String(entry.rank).padStart(width)}. ${style.bold(KIND_LABELS[entry.kind])}  ${subject(entry, pathOf)}`,
      `${indent}${escapeForTerminal(entry.verdict)}`,
      `${indent}${style.dim(evidenceLine(entry))}`,
      `${indent}${escapeForTerminal(entry.designMove)}`,
      ...entry.findings
        .slice(1)
        .flatMap((finding) => [
          `${indent}Also ${finding.kind}${concerning(finding, entry, pathOf)}: ${escapeForTerminal(finding.verdict)}`,
          `${indent}${style.dim(evidenceLine(finding))}`,
          `${indent}${escapeForTerminal(finding.designMove)}`,
        ]),
    ]),
    "",
  ];
};

/**
 * One line pair per finding of each entry point a file belongs to, for
 * `inspect`: the rank and kind with the verdict, and the design move beneath;
 * a further finding of the entry follows as "also", except for the boundary of
 * one territory of a boundary between two, which the verdict already tells; a
 * finding about other territories than its entry's names them ("also boundary
 * of <path>"), by the `territories` of the inspect result. Empty for a file in
 * none.
 */
export const fileEntryPointLines = (
  entryPoints: ReadonlyArray<EntryPoint>,
  territories: ReadonlyArray<{ readonly id: string; readonly path: string }>,
): ReadonlyArray<string> => {
  const pathOf = new Map(territories.map(({ id, path }) => [id, path]));
  return entryPoints.flatMap((entry) => [
    `entry point #${entry.rank} (${entry.kind}): ${escapeForTerminal(entry.verdict)}`,
    `  ${escapeForTerminal(entry.designMove)}`,
    ...entry.findings
      .slice(1)
      .flatMap((finding) =>
        isPartOf(finding, entry)
          ? []
          : [
              `  also ${finding.kind}${concerning(finding, entry, pathOf)}: ${escapeForTerminal(finding.verdict)}`,
              `  ${escapeForTerminal(finding.designMove)}`,
            ],
      ),
  ]);
};
