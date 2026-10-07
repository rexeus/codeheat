// Owns the name a report gives the repository: the repository's, not the
// folder of the work tree an analysis happens to run in.
import { Effect, Path } from "effect";

import type { GitError } from "./git-errors.js";
import { Git } from "./git.js";

const GIT_DIRECTORY = ".git";

/**
 * The name of the repository git runs in, read from its common directory,
 * which every work tree of one repository shares: the folder that holds a
 * `.git` directory (the main work tree), or the name of a bare repository
 * without its `.git` suffix. A linked work tree (`git worktree add`) gets
 * the name of the repository it belongs to, not that of its own folder.
 *
 * Runs git inside the repository, so the `Git` service must be built for it.
 */
export const readRepositoryName: Effect.Effect<
  string,
  GitError,
  Git | Path.Path
> = Effect.gen(function* () {
  const git = yield* Git;
  const path = yield* Path.Path;
  const output = yield* git.text([
    "rev-parse",
    "--path-format=absolute",
    "--git-common-dir",
  ]);
  const common = path.resolve(output.trim());
  const name = path.basename(common);
  if (name === GIT_DIRECTORY) {
    return path.basename(path.dirname(common));
  }
  return name.endsWith(GIT_DIRECTORY)
    ? name.slice(0, -GIT_DIRECTORY.length)
    : name;
});
