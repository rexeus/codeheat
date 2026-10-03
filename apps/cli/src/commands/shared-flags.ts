import { DEFAULT_HALF_LIFE } from "@codeheat/engine";
import { Flag } from "effect/cli";

export const jsonFlag = Flag.Boolean("json").pipe(
  Flag.withDescription(
    "Print one JSON document to stdout instead of the terminal view",
  ),
  Flag.withDefault(false),
);

export const DEFAULT_SINCE = "12m";

const since = Flag.String("since").pipe(
  Flag.withDescription(
    `How far back to look: <n>d, <n>w, <n>m, <n>y, or an ISO date (YYYY-MM-DD); default ${DEFAULT_SINCE}`,
  ),
);

export const halfLifeFlag = Flag.String("half-life").pipe(
  Flag.withDescription(
    `How fast older changes lose weight: a change counts half as much for every <n>d, <n>w, <n>m, or <n>y it lies back from the end of its window (a month is 30 days and a year 365 here, unlike --since); 0 weighs every change the same; default ${DEFAULT_HALF_LIFE}`,
  ),
  Flag.withDefault(DEFAULT_HALF_LIFE),
);

export const entryFlag = Flag.String("entry").pipe(
  Flag.withDescription(
    "Glob of the files that form a module's public interface instead of detecting them from package.json and index files; repeatable",
  ),
  Flag.atLeast(0),
);
export const sinceFlag = since.pipe(Flag.withDefault(DEFAULT_SINCE));

/** `--since` without a default, for commands that must tell whether it was given. */
export const explicitSinceFlag = since.pipe(Flag.optional);
