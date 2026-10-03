// Tests only: building blocks for repositories whose commits belong together.
import { Effect } from "effect";

import { Git } from "../git/git.js";
import type { History, HistoryOptions } from "../history/history.js";
import { readHistory } from "../history/history.js";
import type { TempRepository } from "./temp-repository.js";

/** `count` distinct lines that start with `tag`. */
export const lines = (count: number, tag: string): string =>
  Array.from({ length: count }, (_, index) => `${tag} ${index}\n`).join("");

/**
 * Creates `files` on branch `main` before the analysis window of
 * `readChanges`, so that no commit of the scenarios joins them.
 */
export const startOn = (repo: TempRepository, files: ReadonlyArray<string>) =>
  Effect.gen(function* () {
    yield* repo.git("symbolic-ref", "HEAD", "refs/heads/main");
    yield* repo.commit(
      "2025-12-01T12:00:00Z",
      Object.fromEntries(files.map((file) => [file, lines(3, file)])),
      "chore: start",
    );
  });

/** The history of the 2026 window over `universe`. */
export const readChanges = (
  repo: TempRepository,
  universe: ReadonlyArray<string>,
  options: Partial<HistoryOptions> = {},
) =>
  readHistory({
    since: "2026-01-01T00:00:00.000Z",
    until: "2026-12-31T00:00:00.000Z",
    skipCommits: new Set(),
    universe: new Set(universe),
    ...options,
  }).pipe(Effect.provide(Git.layer(repo.directory)));

/** The paths each change of `history` touched, each list and the lists sorted. */
export const pathsOfChanges = (history: History): Array<Array<string>> =>
  history.changes
    .map(({ files }) =>
      Array.from(files, (id) => history.paths[id] ?? "").toSorted(),
    )
    .toSorted((a, b) => a.join().localeCompare(b.join()));

/** Merges `branch` into the current branch with a merge commit at `date`. */
export const mergeBranch = (
  repo: TempRepository,
  date: string,
  branch: string,
) =>
  repo.gitAt(
    date,
    "merge",
    "--no-ff",
    "--quiet",
    "--message",
    `Merge branch '${branch}'`,
    branch,
  );
