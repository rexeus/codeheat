// Owns the name a report gives the repository: the repository's, not the
// folder of a linked work tree an analysis happens to run in.
import { Effect, Path } from "effect";

import { Git } from "./git.js";

const GIT_DIRECTORY = ".git";

/** One path git printed, or undefined for anything else (none, several lines). */
const singleLine = (output: string): string | undefined => {
  const lines = output.split("\n").filter((line) => line !== "");
  const [only] = lines;
  return lines.length === 1 ? only : undefined;
};

/** The name of a repository by its common directory: the folder that holds `.git`, or a bare repository without its `.git` suffix. */
const nameOfCommonDirectory = (common: string, path: Path.Path): string => {
  const name = path.basename(common);
  if (name === GIT_DIRECTORY) {
    return path.basename(path.dirname(common));
  }
  return name.endsWith(GIT_DIRECTORY)
    ? name.slice(0, -GIT_DIRECTORY.length)
    : name;
};

/** `git rev-parse <flag>` as an absolute path, or undefined when git fails or prints anything but one path. */
const revParsePath = (root: string, flag: string) =>
  Effect.gen(function* () {
    const git = yield* Git;
    const path = yield* Path.Path;
    const output = yield* git
      .text(["rev-parse", flag])
      .pipe(Effect.orElseSucceed(() => ""));
    const line = singleLine(output);
    return line === undefined || line.startsWith("-")
      ? undefined
      : path.resolve(root, line);
  });

/**
 * The name of the repository whose work tree is `root`: the folder of `root`,
 * except in a linked work tree (`git worktree add`, whose git directory is not
 * the common directory every work tree shares), which is named after the
 * repository it belongs to: the folder that holds its `.git`, or a bare
 * repository's name without `.git`. A git directory kept elsewhere
 * (`--separate-git-dir`) does not rename the work tree. Whatever git says that
 * is not one path each, as an old git that does not know a flag may echo it,
 * keeps the folder of `root`.
 *
 * Runs git inside `root`, so the `Git` service must be built for it.
 */
export const readRepositoryName = (
  root: string,
): Effect.Effect<string, never, Git | Path.Path> =>
  Effect.gen(function* () {
    const path = yield* Path.Path;
    const own = path.basename(root);
    const gitDirectory = yield* revParsePath(root, "--git-dir");
    const common = yield* revParsePath(root, "--git-common-dir");
    if (
      gitDirectory === undefined ||
      common === undefined ||
      gitDirectory === common
    ) {
      return own;
    }
    const name = nameOfCommonDirectory(common, path);
    return name === "" ? own : name;
  });
