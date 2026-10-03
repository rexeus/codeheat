// Owns reading the import graph of a repository: which universe file reaches
// which other, for the files a question is about.
import { Effect } from "effect";
import type { FileSystem, Path } from "effect";

import type { LanguageAdapter } from "../code/language-adapter.js";
import type { GitError } from "../git/git-errors.js";
import type { Git } from "../git/git.js";
import { packageDirectoriesOf } from "../modules/package-directories.js";
import {
  listTrackedBlobs,
  listTrackedFiles,
} from "../universe/tracked-files.js";
import type { Dependencies } from "./dependencies.js";
import { loadLinks, reachableFrom } from "./module-links.js";
import type { LinkSources, ModuleLinks, Reach } from "./module-links.js";
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

/** What the files read from the universe import. */
export type ImportGraph = {
  /** The links of every file that was read, those no adapter reads or that do not parse excepted. */
  readonly links: ReadonlyMap<string, ModuleLinks>;
  /** What `file` reaches by importing, directly or through re-exports (see `reachableFrom`); computed once per file. */
  readonly reach: (file: string) => Reach;
  /** The files whose links were read in full: the roots it was asked for. */
  readonly roots: ReadonlySet<string>;
  /** How the graph reads and resolves files, for reading more of them (see `loadDependencies`). */
  readonly sources: LinkSources;
};

/** A graph without any file: nothing is known. */
const EMPTY_IMPORT_GRAPH: ImportGraph = {
  links: new Map(),
  roots: new Set(),
  reach: (file) => reachableFrom(new Map(), file),
  sources: {
    root: "",
    adapters: [],
    resolve: () => ({ files: [], resolved: false }),
  },
};

/** What the roots of `graph` load directly, in the shape of `loadDependencies`. */
export const rootDependencies = ({ links, roots }: ImportGraph): Dependencies =>
  new Map(
    [...roots].flatMap((file) => {
      const found = links.get(file);
      return found === undefined ? [] : [[file, found.targets]];
    }),
  );

/**
 * Reads the links of `roots` and of the files that decide what they reach (see
 * `loadLinks`). Only the roots, and the files they import that may forward
 * further, are read; with no adapter nothing is read at all.
 */
export const readImportGraph = (
  options: LinkOptions,
  roots: ReadonlySet<string>,
): Effect.Effect<
  ImportGraph,
  GitError,
  FileSystem.FileSystem | Path.Path | Git
> =>
  Effect.gen(function* () {
    if (options.adapters.length === 0) {
      return EMPTY_IMPORT_GRAPH;
    }
    const tracked = yield* listTrackedFiles(options.scope);
    const manifests = yield* listTrackedBlobs(options.scope);
    const workspace = yield* readWorkspace(
      options.root,
      options.universe,
      packageDirectoriesOf(manifests),
      manifestFilesFor(options.scope, manifests),
    );
    const sources: LinkSources = {
      root: options.root,
      adapters: options.adapters,
      resolve: createResolver({
        universe: options.universe,
        tracked: new Set(tracked),
        ...workspace,
      }),
    };
    const links = yield* loadLinks(sources, roots);
    const reached = new Map<string, Reach>();
    const reach = (file: string): Reach => {
      const known = reached.get(file) ?? reachableFrom(links, file);
      reached.set(file, known);
      return known;
    };
    return { links, roots, reach, sources };
  });
