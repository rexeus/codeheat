// Tests only: repositories whose commits are spread over months, one change at a time.
import { Effect } from "effect";

import { lines } from "./logical-changes.js";
import type { TempRepository } from "./temp-repository.js";

/** One commit: the files it modifies, and its message (`change` without one). */
export type Change = {
  readonly files: ReadonlyArray<string>;
  readonly message?: string;
};

/** A commit that modifies `files`. */
export const touching = (...files: ReadonlyArray<string>): Change => ({
  files,
});

/** `count` commits that each modify `files`. */
export const repeated = (
  count: number,
  ...files: ReadonlyArray<string>
): ReadonlyArray<Change> =>
  Array.from({ length: count }, () => touching(...files));

/** Creates `files` at `date`, by default the start of 2024: more than 24 months before the 2026-06-01 the tests analyze at. */
export const createFiles = (
  repo: TempRepository,
  files: Readonly<Record<string, string>>,
  date = "2024-01-01T12:00:00Z",
) => repo.commit(date, files);

/**
 * Commits `changes` in `month` (`YYYY-MM`), one a day from the first, each
 * rewriting its files with content that no earlier commit had. At most 28.
 */
export const commitInMonth = (
  repo: TempRepository,
  month: string,
  changes: ReadonlyArray<Change>,
) =>
  Effect.gen(function* () {
    for (const [index, { files, message }] of changes.entries()) {
      const day = String(index + 1).padStart(2, "0");
      yield* repo.commit(
        `${month}-${day}T12:00:00Z`,
        Object.fromEntries(
          files.map((file) => [file, lines(index + 4, `${month} ${file}`)]),
        ),
        message ?? `change ${index + 1}`,
      );
    }
  });

/**
 * A month in the middle of each of the eight quarters before 2026-06-01, which
 * `analyze` cuts a 24-month window into (the last four for 12 months), oldest first.
 */
const QUARTER_MONTHS = [
  "2024-07",
  "2024-10",
  "2025-01",
  "2025-04",
  "2025-07",
  "2025-10",
  "2026-01",
  "2026-04",
] as const;

/**
 * Commits `quarters`, the changes of one quarter each, in the last quarters
 * before 2026-06-01 (at most eight): the last entry is the latest quarter.
 */
export const commitQuarters = (
  repo: TempRepository,
  quarters: ReadonlyArray<ReadonlyArray<Change>>,
) =>
  Effect.gen(function* () {
    for (const [index, changes] of quarters.entries()) {
      const month = QUARTER_MONTHS.at(index - quarters.length);
      if (month !== undefined) {
        yield* commitInMonth(repo, month, changes);
      }
    }
  });

export const FILE_A = "packages/a/a.ts";
export const FILE_B = "packages/b/b.ts";

/** Two packages, `a` and `b`, each with one file, created at `date` (see `createFiles`). */
export const createTwoPackages = (repo: TempRepository, date?: string) =>
  createFiles(
    repo,
    {
      "packages/a/package.json": '{ "name": "a" }\n',
      "packages/b/package.json": '{ "name": "b" }\n',
      [FILE_A]: lines(3, "a"),
      [FILE_B]: lines(3, "b"),
    },
    date,
  );

/**
 * Quarters of ten changes each over `createTwoPackages`' files, the ones of
 * `both` touching both packages and the rest only `a`.
 */
export const quartersSpreading = (
  both: ReadonlyArray<number>,
): ReadonlyArray<ReadonlyArray<Change>> =>
  both.map((count) => [
    ...repeated(count, FILE_A, FILE_B),
    ...repeated(10 - count, FILE_A),
  ]);
