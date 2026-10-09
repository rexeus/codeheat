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

export const entryFlag = Flag.String("entry").pipe(
  Flag.withDescription(
    "Glob of the files that form a module's public interface instead of detecting them from package.json and index files; repeatable",
  ),
  Flag.atLeast(0),
);
export const sinceFlag = since.pipe(Flag.withDefault(DEFAULT_SINCE));

/** `--include`, `--exclude`, and `--default-excludes`: which files the analysis counts. */
export const universeFlags = {
  include: Flag.String("include").pipe(
    Flag.withDescription(
      "Glob of files to analyze instead of the language list; repeatable",
    ),
    Flag.atLeast(0),
  ),
  exclude: Flag.String("exclude").pipe(
    Flag.withDescription(
      "Glob of files to leave out, besides the default patterns; repeatable",
    ),
    Flag.atLeast(0),
  ),
  defaultExcludes: Flag.Boolean("default-excludes").pipe(
    Flag.withDescription(
      "Leave out test code, mocks, generated and minified files, build output, coverage, and dependencies by the default glob patterns (README, Excluded files); --no-default-excludes leaves out only what --exclude names",
    ),
    Flag.withDefault(true),
  ),
};

/** `--since` without a default, for commands that must tell whether it was given. */
export const explicitSinceFlag = since.pipe(Flag.optional);
