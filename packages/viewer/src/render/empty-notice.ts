import type { Report } from "@codeheat/engine";

import { formatDay } from "./format.js";

/** The side panel's one-line replacement for an empty hotspot list. */
export const EMPTY_PANEL_NOTE = "No files to rank.";

/** Explains an empty report: names the analysis window and the flags that change it. */
export const emptyNotice = ({
  since,
  until,
}: Report["window"]): { readonly title: string; readonly detail: string } => ({
  title: "No files to show",
  detail: `No files were analyzed between ${formatDay(since)} and ${formatDay(until)}. Widen the window with --since, or select files with --include.`,
});
