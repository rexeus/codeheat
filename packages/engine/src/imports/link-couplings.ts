// Owns telling hidden coupling from visible: for each coupled pair, whether a
// static import connects the two files.
import { Effect } from "effect";
import type { FileSystem, Path } from "effect";

import type { LanguageAdapter } from "../code/language-adapter.js";
import type { Coupling } from "../report/report.js";
import { loadLinks, reachableFrom } from "./module-links.js";
import type { ModuleLinks } from "./module-links.js";
import { createResolver } from "./resolve.js";
import { readWorkspacePackages } from "./workspace-packages.js";

export type LinkOptions = {
  /** Absolute path of the work tree root. */
  readonly root: string;
  /** Every universe file; imports of other files link nothing. */
  readonly universe: ReadonlySet<string>;
  /** Directories whose `package.json` names a package other files can import; see `listPackageDirectories`. */
  readonly packageDirectories: ReadonlySet<string>;
  /** Entry points per module path; what importing a package by name reaches. */
  readonly entryPoints: ReadonlyMap<string, ReadonlyArray<string>>;
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

const importsOf = (
  { a, b }: Coupling,
  links: ReadonlyMap<string, ModuleLinks>,
  reach: (file: string) => ReadonlySet<string>,
): Coupling["imports"] =>
  links.has(a) && links.has(b)
    ? relation(reach(a).has(b), reach(b).has(a))
    : null;

/**
 * Sets `imports` on every coupling: which of its two files imports the other,
 * directly or through the re-exports of the module it imports. Only the
 * coupled files, and the files that decide what they reach, are read. A
 * coupling where either file is not read by an adapter or does not parse
 * keeps `imports: null`.
 */
export const linkCouplings = (
  options: LinkOptions,
  couplings: ReadonlyArray<Coupling>,
): Effect.Effect<
  ReadonlyArray<Coupling>,
  never,
  FileSystem.FileSystem | Path.Path
> =>
  Effect.gen(function* () {
    if (options.adapters.length === 0 || couplings.length === 0) {
      return couplings;
    }
    const links = yield* loadLinks(
      {
        root: options.root,
        adapters: options.adapters,
        resolve: createResolver(
          options.universe,
          yield* readWorkspacePackages(
            options.root,
            options.packageDirectories,
            options.entryPoints,
          ),
        ),
      },
      new Set(couplings.flatMap(({ a, b }) => [a, b])),
    );
    const reached = new Map<string, ReadonlySet<string>>();
    const reach = (file: string): ReadonlySet<string> => {
      const known = reached.get(file) ?? reachableFrom(links, file);
      reached.set(file, known);
      return known;
    };
    return couplings.map((coupling) => ({
      ...coupling,
      imports: importsOf(coupling, links, reach),
    }));
  });
