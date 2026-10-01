/** The side panel's one-line replacement for an empty hotspot list. */
export const EMPTY_PANEL_NOTE = "No files to rank.";

/**
 * Explains an empty report. Every file of the analysis universe is listed,
 * even one without revisions, so the cause is the universe and the advice
 * changes what it contains, never the time window.
 */
export const EMPTY_NOTICE = {
  title: "No files in the analysis universe",
  detail:
    "No code files were selected, so there is nothing to map. Check the path argument, or choose files with --include and --exclude.",
} as const;
