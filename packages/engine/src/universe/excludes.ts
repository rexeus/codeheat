// Owns what an analysis leaves out by name: one visible list of glob patterns,
// the defaults followed by the user's, and which of them leaves a path out.
import { matchesAny } from "./globs.js";

/** Where an exclude pattern comes from: the default list or `--exclude`. */
type ExcludeSource = "default" | "user";

/** One exclude pattern an analysis applies. */
export type ExcludePattern = {
  readonly pattern: string;
  readonly source: ExcludeSource;
};

/**
 * The patterns an analysis leaves out unless told otherwise: test code, mocks,
 * generated and minified files, build output, coverage, and vendored or
 * installed dependencies. They are names, not proof: a production folder
 * named `build` is left out too, which `--no-default-excludes` undoes.
 */
const DEFAULT_EXCLUDES: ReadonlyArray<string> = [
  "**/*.test.*",
  "**/*.spec.*",
  "**/__tests__/**",
  "**/__mocks__/**",
  "**/test/**",
  "**/tests/**",
  "**/e2e/**",
  "**/*.gen.*",
  "**/*.generated.*",
  "**/*.min.*",
  "**/dist/**",
  "**/build/**",
  "**/coverage/**",
  "**/generated/**",
  "**/__generated__/**",
  "**/tsp-output/**",
  "**/vendor/**",
  "**/node_modules/**",
];

/**
 * The patterns an analysis applies, in the order that decides which of them
 * leaves a file out: the default list unless `withDefaults` is false, then
 * `user` in the order given. A pattern given twice is applied once, where it
 * first appears.
 */
export const activeExcludes = (
  user: ReadonlyArray<string>,
  withDefaults: boolean,
): ReadonlyArray<ExcludePattern> => {
  const all: ReadonlyArray<ExcludePattern> = [
    ...(withDefaults ? DEFAULT_EXCLUDES : []).map((pattern) => ({
      pattern,
      source: "default" as const,
    })),
    ...user.map((pattern) => ({ pattern, source: "user" as const })),
  ];
  return all.filter(
    ({ pattern }, index) =>
      all.findIndex((other) => other.pattern === pattern) === index,
  );
};

/**
 * A lookup of the pattern that leaves a repository-relative path out: the
 * first of `excludes` that matches it (see `matchesAny`), or undefined for a
 * path none matches.
 */
export const excludingPattern = (
  excludes: ReadonlyArray<ExcludePattern>,
): ((path: string) => ExcludePattern | undefined) => {
  const matchers = excludes.map((exclude) => ({
    exclude,
    matches: matchesAny([exclude.pattern]),
  }));
  return (path) => matchers.find(({ matches }) => matches(path))?.exclude;
};

/** An exclude pattern with the number of files it left out. */
export type ExcludeCount = ExcludePattern & { readonly files: number };

/**
 * Splits `paths` into those no pattern of `excludes` matches, in their order,
 * and the count of the paths each pattern leaves out: every pattern of
 * `excludes`, in order, a pattern that left nothing out with 0. A path that
 * several patterns match counts for the first (see `excludingPattern`), so the
 * counts add up to the paths left out.
 */
export const applyExcludes = (
  paths: ReadonlyArray<string>,
  excludes: ReadonlyArray<ExcludePattern>,
): {
  readonly kept: ReadonlyArray<string>;
  readonly excluded: ReadonlyArray<ExcludeCount>;
} => {
  const excludedBy = excludingPattern(excludes);
  const counts = new Map<ExcludePattern, number>();
  const kept: Array<string> = [];
  for (const path of paths) {
    const exclude = excludedBy(path);
    if (exclude === undefined) {
      kept.push(path);
    } else {
      counts.set(exclude, (counts.get(exclude) ?? 0) + 1);
    }
  }
  return {
    kept,
    excluded: excludes.map((exclude) => ({
      ...exclude,
      files: counts.get(exclude) ?? 0,
    })),
  };
};
