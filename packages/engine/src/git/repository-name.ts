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

/** Whether the repository is bare (`core.bare` is `true`); false when git fails or the key is unset. */
const isBare = Effect.gen(function* () {
  const git = yield* Git;
  const output = yield* git
    .text(["config", "--get", "core.bare"])
    .pipe(Effect.orElseSucceed(() => ""));
  return output.trim() === "true";
});

/**
 * The name of a bare repository by its directory: without its `.git` suffix
 * (`shop.git` is `shop`), or, for a hidden directory inside the project it
 * serves (`proj/.bare`), the name of the folder that holds it.
 */
const nameOfBare = (common: string, path: Path.Path): string => {
  const name = path.basename(common);
  if (name.startsWith(".")) {
    return path.basename(path.dirname(common));
  }
  return name.endsWith(GIT_DIRECTORY)
    ? name.slice(0, -GIT_DIRECTORY.length)
    : name;
};

/** The name of the repository a linked work tree belongs to, by its common directory; undefined when that directory does not say. */
const nameOfCommon = (common: string) =>
  Effect.gen(function* () {
    const path = yield* Path.Path;
    if (path.basename(common) === GIT_DIRECTORY) {
      return path.basename(path.dirname(common));
    }
    return (yield* isBare) ? nameOfBare(common, path) : undefined;
  });

/**
 * The name of the repository whose work tree is `root`: the folder of `root`,
 * except in a linked work tree (`git worktree add`, whose git directory is not
 * the common directory every work tree shares), which is named after the
 * repository it belongs to when its common directory says: the folder that
 * holds that `.git` directory, or a bare repository's name without `.git`
 * (the folder that holds it, for a hidden one such as `proj/.bare`). A
 * repository whose git directory lies elsewhere (`--separate-git-dir`) names
 * no folder, so each of its work trees keeps its own. Whatever git says that
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
    const name = yield* nameOfCommon(common);
    return name === undefined || name === "" ? own : name;
  });
