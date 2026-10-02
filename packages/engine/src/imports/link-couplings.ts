// Owns telling hidden coupling from visible: for each coupled pair, whether a
// static import connects the two files, and whether we can tell.
import { Effect } from "effect";
import type { FileSystem, Path } from "effect";

import type { LanguageAdapter } from "../code/language-adapter.js";
import type { GitError } from "../git/git-errors.js";
import type { Git } from "../git/git.js";
import { packageDirectoriesOf } from "../modules/package-directories.js";
import type { Coupling } from "../report/report.js";
import {
  listTrackedBlobs,
  listTrackedFiles,
} from "../universe/tracked-files.js";
import { loadLinks, reachableFrom } from "./module-links.js";
import type { ModuleLinks, Reach } from "./module-links.js";
import { createResolver } from "./resolve.js";
import { manifestFilesFor, readWorkspace } from "./workspace-packages.js";

export type LinkOptions = {
  /** Absolute path of the work tree root. */
  readonly root: string;
  /** Repository-relative directory or file the universe is limited to; "." for all. */
  readonly scope: string;
  /** Every universe file; imports of other files link nothing. */
  readonly universe: ReadonlySet<string>;
  readonly adapters: ReadonlyArray<LanguageAdapter>;
};

const relation = (
  forward: boolean,
  backward: boolean,
): Exclude<Coupling["imports"], null> => {
  if (forward && backward) {
    return "both";
  }
  if (forward) {
    return "a→b";
  }
  return backward ? "b→a" : "none";
};

/**
 * An import in either direction is certain. No import is only certain when
 * every module that the two files, and what they re-export through, load is
 * accounted for; otherwise the missing one may be the import.
 */
const importsOf = (
  { a, b }: Coupling,
  links: ReadonlyMap<string, ModuleLinks>,
  reach: (file: string) => Reach,
): Coupling["imports"] => {
  const from = links.get(a);
  const to = links.get(b);
  if (from === undefined || to === undefined) {
    return null;
  }
  const forward = reach(a);
  const backward = reach(b);
  const found = relation(forward.files.has(b), backward.files.has(a));
  const everythingKnown =
    from.complete && to.complete && forward.known && backward.known;
  return found === "none" && !everythingKnown ? null : found;
};

/**
 * Sets `imports` on every coupling: which of its two files imports the other,
 * directly or through the re-exports of the module it imports, `none` when
 * neither does and every import involved is accounted for (see
 * `ModuleLinks.complete`), and null when it cannot be told. Only the coupled
 * files, and the files that decide what they reach, are read. A coupling
 * where either file is not read by an adapter or does not parse is null.
 */
export const linkCouplings = (
  options: LinkOptions,
  couplings: ReadonlyArray<Coupling>,
): Effect.Effect<
  ReadonlyArray<Coupling>,
  GitError,
  FileSystem.FileSystem | Path.Path | Git
> =>
  Effect.gen(function* () {
    if (options.adapters.length === 0 || couplings.length === 0) {
      return couplings;
    }
    const tracked = yield* listTrackedFiles(options.scope);
    const manifests = yield* listTrackedBlobs(options.scope);
    const workspace = yield* readWorkspace(
      options.root,
      options.universe,
      packageDirectoriesOf(manifests),
      manifestFilesFor(options.scope, manifests),
    );
    const links = yield* loadLinks(
      {
        root: options.root,
        adapters: options.adapters,
        resolve: createResolver({
          universe: options.universe,
          tracked: new Set(tracked),
          ...workspace,
        }),
      },
      new Set(couplings.flatMap(({ a, b }) => [a, b])),
    );
    const reached = new Map<string, Reach>();
    const reach = (file: string): Reach => {
      const known = reached.get(file) ?? reachableFrom(links, file);
      reached.set(file, known);
      return known;
    };
    return couplings.map((coupling) => ({
      ...coupling,
      imports: importsOf(coupling, links, reach),
    }));
  });
