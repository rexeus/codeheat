// Owns the terminal's answer to "where do I start": the ranked entry points
// with their verdict, their numbers in plain words, and the design move.
import type { Report } from "@codeheat/engine";

import { escapeForTerminal } from "../escape.js";
import { percent } from "./format.js";
import type { Style } from "./style.js";

type EntryPoint = Report["entryPoints"][number];

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

/** What the entry is about, as paths: the territories of a territory kind, the files of a file kind. */
const subject = (
  entry: EntryPoint,
  pathOf: ReadonlyMap<string, string>,
): string => {
  const names =
    entry.kind === "boundary" || entry.kind === "clique"
      ? entry.territories.map((id) => pathOf.get(id) ?? id)
      : entry.files;
  // a group territory's path already joins its folders with " + "
  return names
    .map((name) => escapeForTerminal(name))
    .join(entry.kind === "coupling" ? " <-> " : ", ");
};

/** A number of the entry's evidence, 0 when the entry has none by that name. */
type Numbers = (name: string) => number;

const EVIDENCE_LINES: Readonly<
  Record<
    EntryPoint["kind"],
    (at: Numbers, evidence: EntryPoint["evidence"]) => string
  >
> = {
  boundary: (at, evidence) =>
    `${percent(at("heatShare"))} of the heat; ${percent(at("containment"))} of its ${counted(at("changes"), "change")} stay inside${evidence["partnerShare"] === undefined ? "" : `, ${percent(at("partnerShare"))} also touch its closest partner`}`,
  hotspot: (at) =>
    `${percent(at("heatShare"))} of the heat; ${percent(at("chronicShare"))} of it in ${counted(at("chronicFiles"), "chronic hotspot")}`,
  clique: (at) =>
    `${percent(at("heatShare"))} of the heat; ${counted(at("sharedChanges"), "change")} touched all ${at("territories")}, every pair shares at least ${percent(at("weakestShare"))}`,
  copies: (at) =>
    `${counted(at("files"), "file")}, at least ${percent(at("similarity"))} alike; ${counted(at("changesToAll"), "change")} touched every copy`,
  coupling: (at) =>
    `${counted(at("sharedChanges"), "change")} touched both, ${percent(at("degree"))} of the time either changes; no import links them`,
  hub: (at) =>
    `${counted(at("fanIn"), "file")} depend on it, ${at("changedDependents")} of them changed together with it; ${counted(at("changes"), "change")} touched it`,
};

/** The numbers behind the entry, in a sentence a newcomer can read. */
const evidenceLine = ({ kind, evidence }: EntryPoint): string =>
  EVIDENCE_LINES[kind]((name) => evidence[name] ?? 0, evidence);

/**
 * The "Where to start" section: one block per entry point, best first, each
 * with its kind, what it is about (paths joined with `, `, the two files of a
 * coupling with `<->`), the verdict, the numbers, and the design move; the
 * paths are made safe to print. Empty when the report has no entry
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
    ]),
    "",
  ];
};

/**
 * One line pair per entry point a file belongs to, for `inspect`: the rank and
 * kind with the verdict, and the design move beneath. Empty for a file in none.
 */
export const fileEntryPointLines = (
  entryPoints: ReadonlyArray<EntryPoint>,
): ReadonlyArray<string> =>
  entryPoints.flatMap((entry) => [
    `entry point #${entry.rank} (${entry.kind}): ${escapeForTerminal(entry.verdict)}`,
    `  ${escapeForTerminal(entry.designMove)}`,
  ]);
