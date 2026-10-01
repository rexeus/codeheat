import { Flag } from "effect/cli";

export const jsonFlag = Flag.Boolean("json").pipe(
  Flag.withDescription(
    "Print one JSON document to stdout instead of the terminal view",
  ),
  Flag.withDefault(false),
);

export const sinceFlag = Flag.String("since").pipe(
  Flag.withDescription(
    "How far back to look: <n>d, <n>w, <n>m, <n>y, or an ISO date (YYYY-MM-DD)",
  ),
  Flag.withDefault("12m"),
);

export const entryFlag = Flag.String("entry").pipe(
  Flag.withDescription(
    "Glob of the files that form a module's public interface instead of detecting them from package.json and index files; repeatable",
  ),
  Flag.atLeast(0),
);
