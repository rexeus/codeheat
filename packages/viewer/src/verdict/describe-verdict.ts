// Owns the words of the repository-level answer to "does the design hold up
// to the way the code changes?": the engine judges it (`Report.verdict`),
// this names the level and says why there is none.
import type { Report } from "@codeheat/engine";

import { quietWindowOf } from "./quiet-window.js";

/** `holds`: territories that contain their changes hold most of the work. `unknown`: nothing to judge. */
export type VerdictLevel = Report["verdict"]["level"];

export type Verdict = {
  readonly level: VerdictLevel;
  /** Two or three words naming the level, for a badge beside the question. */
  readonly label: string;
  /** Why there is no verdict, in one sentence; empty for a known level, whose numbers the answer cards show. */
  readonly reason: string;
  /** A line under the reason: where the history last changed and what to try, for a window without counted changes; empty otherwise. */
  readonly note: string;
};

const LABELS: Record<VerdictLevel, string> = {
  holds: "Holds up",
  mixed: "Holds in parts",
  strained: "Under strain",
  unknown: "Not enough evidence",
};

const NO_TERRITORIES =
  "This report has no territories, so it cannot say whether the design holds; analyze again with a current codeheat.";

const TOO_LITTLE_EVIDENCE =
  "Too little of the change effort sits in territories with enough changes to judge the design.";

type Words = Pick<Verdict, "reason" | "note">;

const TOO_LITTLE: Words = { reason: TOO_LITTLE_EVIDENCE, note: "" };

/** What to say for each reason the engine gives; a window without counted changes also says when the history last changed. */
const WORDS: Record<
  NonNullable<Report["verdict"]["reason"]>,
  (report: Report) => Words
> = {
  "no-territories": () => ({ reason: NO_TERRITORIES, note: "" }),
  "quiet-window": (report) => {
    const quiet = quietWindowOf(report);
    return quiet === null
      ? TOO_LITTLE
      : { reason: quiet.sentence, note: quiet.note };
  },
  "too-little-evidence": () => TOO_LITTLE,
};

/**
 * Whether the design holds up to the way the code changes, for the whole
 * repository, in words: the level the engine judged (`Report.verdict`), its
 * name, and for a report with no verdict why not and what to try.
 */
export const describeVerdict = (report: Report): Verdict => {
  const { level, reason } = report.verdict;
  return {
    level,
    label: LABELS[level],
    ...(reason === null ? { reason: "", note: "" } : WORDS[reason](report)),
  };
};
