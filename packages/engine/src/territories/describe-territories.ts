// Owns the one line each territory carries about what it is: its manifest's
// description, else the first sentence of its README, else its most changed
// files. Manifests and READMEs are read from the work tree, only those git
// tracks as regular files.
import { Effect, FileSystem, Option, Path } from "effect";

import type { Territories } from "../model/territory.js";
import type { TerritoryTree, TerritoryDraft } from "./build-territories.js";
import { mainFiles, tidy } from "./description-text.js";
import { manifestDescription } from "./manifest-description.js";
import type { TerritoryFile } from "./node-measures.js";
import { readmeSentence } from "./readme-sentence.js";

/** Larger manifests and READMEs are not read. */
const MAX_DOCUMENT_BYTES = 262_144;
/** Manifests and READMEs read at once; bounds open file handles. */
const READ_CONCURRENCY = 8;
/** Manifest names that can declare a description, the preferred first. */
const MANIFESTS = ["package.json", "Cargo.toml", "pyproject.toml", "pom.xml"];
/** README names, the preferred first. */
const README = /^readme(?:\.(md|markdown|mdx|rst|txt))?$/iu;
const README_ORDER = ["md", "markdown", "mdx", "rst", "txt", undefined];

/** The tracked manifest and README of each directory ("" is the root). */
type Documents = {
  readonly manifests: ReadonlyMap<string, string>;
  readonly readmes: ReadonlyMap<string, string>;
};

const directoryOf = (path: string): string =>
  path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "";

const nameOf = (path: string): string => path.slice(path.lastIndexOf("/") + 1);

const readmeRank = (name: string): number =>
  README_ORDER.indexOf(README.exec(name)?.[1]?.toLowerCase());

const documentsOf = (tracked: ReadonlyArray<string>): Documents => {
  const manifests = new Map<string, string>();
  const readmes = new Map<string, string>();
  for (const path of tracked) {
    const directory = directoryOf(path);
    const name = nameOf(path);
    const manifest = manifests.get(directory);
    if (
      MANIFESTS.includes(name) &&
      (manifest === undefined ||
        MANIFESTS.indexOf(name) < MANIFESTS.indexOf(nameOf(manifest)))
    ) {
      manifests.set(directory, path);
    }
    const readme = readmes.get(directory);
    if (
      README.test(name) &&
      (readme === undefined || readmeRank(name) < readmeRank(nameOf(readme)))
    ) {
      readmes.set(directory, path);
    }
  }
  return { manifests, readmes };
};

/**
 * The directories whose documents describe a territory: its own, then those
 * above it that the territory's path skipped over (a package whose code all
 * lies in `src` is `packages/x/src` when it is not itself a package), but not
 * those of its parent.
 */
const documentedDirectories = (
  draft: TerritoryDraft,
  parentPath: string,
): ReadonlyArray<string> => {
  const own = draft.path === "." ? "" : draft.path;
  const directories = [own];
  for (
    let above = directoryOf(own);
    above !== "" &&
    above !== parentPath &&
    above.startsWith(parentPath === "" ? "" : `${parentPath}/`);
    above = directoryOf(above)
  ) {
    directories.push(above);
  }
  return directories;
};

const readDocument = (
  root: string,
  file: string,
): Effect.Effect<
  string | undefined,
  never,
  FileSystem.FileSystem | Path.Path
> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const location = path.join(root, file);
    // git tracks a regular file, but the work tree may hold a link in its place.
    if (Option.isSome(yield* Effect.option(fs.readLink(location)))) {
      return undefined;
    }
    const info = yield* fs.stat(location);
    if (info.type !== "File" || info.size > BigInt(MAX_DOCUMENT_BYTES)) {
      return undefined;
    }
    return yield* fs.readFileString(location);
  }).pipe(Effect.orElseSucceed(() => undefined));

/** What the manifest or README of the first of `directories` that says something says, as one safe line. */
const documentedAs = (
  root: string,
  files: ReadonlyMap<string, string>,
  directories: ReadonlyArray<string>,
  extract: (name: string, text: string) => string | undefined,
): Effect.Effect<
  string | undefined,
  never,
  FileSystem.FileSystem | Path.Path
> =>
  Effect.gen(function* () {
    for (const directory of directories) {
      const file = files.get(directory);
      const text =
        file === undefined ? undefined : yield* readDocument(root, file);
      const said =
        file === undefined || text === undefined
          ? ""
          : tidy(extract(nameOf(file), text) ?? "");
      if (said !== "") {
        return said;
      }
    }
    return undefined;
  });

/** What the manifest of the first of `directories` that has a description says, else what the first README with a sentence says. */
const documentationOf = (
  root: string,
  documents: Documents,
  directories: ReadonlyArray<string>,
): Effect.Effect<
  string | undefined,
  never,
  FileSystem.FileSystem | Path.Path
> =>
  Effect.gen(function* () {
    const manifest = yield* documentedAs(
      root,
      documents.manifests,
      directories,
      manifestDescription,
    );
    return (
      manifest ??
      (yield* documentedAs(
        root,
        documents.readmes,
        directories,
        (_name, text) => readmeSentence(text),
      ))
    );
  });

const isReal = ({ kind }: Pick<TerritoryDraft, "kind">): boolean =>
  kind === "package" || kind === "folder";

const describe = (
  draft: TerritoryDraft,
  documented: string | undefined,
  byPath: ReadonlyMap<string, TerritoryFile>,
): string => {
  const main = mainFiles(draft.members, byPath);
  const text = isReal(draft)
    ? (documented ?? main)
    : [draft.lead ?? "", main].filter((part) => part !== "").join("; ");
  return tidy(text === "" ? draft.path : text);
};

/**
 * Gives each territory its description. A package or folder takes the
 * `description` of its manifest, else the first sentence of its README, else
 * names its most changed files; a group, loose files, a bucket, and test-only
 * code say what they are and name their most changed files. `tracked` lists
 * the regular files git tracks, from which the manifests and READMEs are found.
 */
export const describeTerritories = (
  root: string,
  tree: TerritoryTree,
  files: ReadonlyArray<TerritoryFile>,
  tracked: ReadonlyArray<string>,
): Effect.Effect<Territories, never, FileSystem.FileSystem | Path.Path> =>
  Effect.gen(function* () {
    const documents = documentsOf(tracked);
    const byPath = new Map(files.map((file) => [file.path, file]));
    const pathOf = new Map(tree.nodes.map(({ id, path }) => [id, path]));
    const documented = yield* Effect.forEach(
      tree.nodes,
      (draft) => {
        const parent = pathOf.get(draft.parent ?? "") ?? ".";
        return isReal(draft)
          ? documentationOf(
              root,
              documents,
              documentedDirectories(draft, parent === "." ? "" : parent),
            )
          : Effect.succeed(undefined);
      },
      { concurrency: READ_CONCURRENCY },
    );
    return {
      recommended: tree.recommended,
      details: tree.details,
      nodes: tree.nodes.map(({ members, lead, ...node }, index) => ({
        ...node,
        description: describe(
          { ...node, members, lead },
          documented[index],
          byPath,
        ),
      })),
    };
  });
