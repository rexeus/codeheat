// Owns reading the content of patches: a digest per changed file that says
// what the file's change was and what its reverse would be, so a revert can be
// told from a commit that only has the same line counts. Only the files asked
// for are digested; the rest is skipped without being hashed or held.
//
// The input is `git log -p --no-renames --full-index --format="commit %H"`.
// Each commit starts with a `commit <sha>` line; each file with
// `diff --git a/<path> b/<path>`; a text file's hunks follow `@@` lines. Lines
// inside a hunk begin with a space, `+`, `-`, or `\`, so no content can pass
// for a structural line.
import { LineHash } from "./hash.js";

/** What one file's change was, and what undoing it would be. */
export type FileDigest = {
  readonly forward: string;
  readonly reverse: string;
  /**
   * False when the digest cannot stand for the content: the file appears twice
   * in the commit, or a changed line did not decode as text (its bytes became
   * U+FFFD), which would make different lines equal.
   */
  readonly comparable: boolean;
};

/** The digest of each requested file a commit changed, by path. */
export type CommitDigests = ReadonlyMap<string, FileDigest>;

type OpenFile = {
  readonly path: string;
  readonly forward: LineHash;
  readonly reverse: LineHash;
  /** The deleted and added lines of the group being read, until context ends it. */
  deleted: Array<string>;
  added: Array<string>;
  /** The list the last changed line went to, which a `\\ No newline` line marks. */
  last: Array<string> | undefined;
  inHunk: boolean;
  blobs: { readonly old: string; readonly new: string } | undefined;
  binary: boolean;
  lossy: boolean;
};

const COMMIT = "commit ";
const FILE = "diff --git ";
const INDEX = /^index ([0-9a-f]+)\.\.([0-9a-f]+)/u;
const REPLACEMENT = "\uFFFD";
const SOURCE_PREFIX = "a/";
const QUOTED_ESCAPES: ReadonlyMap<string, number> = new Map([
  ["a", 7],
  ["b", 8],
  ["f", 12],
  ["n", 10],
  ["r", 13],
  ["t", 9],
  ["v", 11],
  ['"', 34],
  ["\\", 92],
]);
const OCTAL = /^[0-7]{1,3}/u;

/** The text of a C-style quoted path (`"a/q\"z.ts"`), or undefined when it is not valid. */
const unquote = (quoted: string): string | undefined => {
  const bytes: Array<number> = [];
  const encoder = new TextEncoder();
  let index = 1;
  while (index < quoted.length && quoted[index] !== '"') {
    const character = quoted[index] ?? "";
    if (character !== "\\") {
      bytes.push(...encoder.encode(character));
      index += 1;
      continue;
    }
    const octal = OCTAL.exec(quoted.slice(index + 1))?.[0];
    const escaped = QUOTED_ESCAPES.get(quoted[index + 1] ?? "");
    if (octal !== undefined) {
      bytes.push(Number.parseInt(octal, 8));
      index += 1 + octal.length;
    } else if (escaped === undefined) {
      return undefined;
    } else {
      bytes.push(escaped);
      index += 2;
    }
  }
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(
      Uint8Array.from(bytes),
    );
  } catch {
    return undefined;
  }
};

/** The path of `diff --git a/X b/X`; with renames off both sides name the same file. */
const pathOfHeader = (line: string): string | undefined => {
  const names = line.slice(FILE.length);
  if (names.startsWith('"')) {
    const source = unquote(names);
    return source?.startsWith(SOURCE_PREFIX) === true
      ? source.slice(SOURCE_PREFIX.length)
      : undefined;
  }
  const length = (names.length - "a/ b/".length) / 2;
  return Number.isInteger(length) ? names.slice(2, 2 + length) : undefined;
};

const flushGroup = (file: OpenFile): void => {
  if (file.deleted.length === 0 && file.added.length === 0) {
    return;
  }
  file.forward.update("@");
  file.reverse.update("@");
  // the reverse of a group deletes what the group added and adds what it deleted
  for (const line of file.deleted) {
    file.forward.update(`-${line}`);
  }
  for (const line of file.added) {
    file.forward.update(`+${line}`);
    file.reverse.update(`-${line}`);
  }
  for (const line of file.deleted) {
    file.reverse.update(`+${line}`);
  }
  file.deleted = [];
  file.added = [];
  file.last = undefined;
};

const finish = (file: OpenFile): FileDigest => {
  flushGroup(file);
  if (file.binary && file.blobs !== undefined) {
    return {
      forward: `bin:${file.blobs.old}>${file.blobs.new}`,
      reverse: `bin:${file.blobs.new}>${file.blobs.old}`,
      comparable: true,
    };
  }
  return {
    forward: file.forward.digest(),
    reverse: file.reverse.digest(),
    comparable: !file.lossy,
  };
};

/**
 * Turns chunks of patch output into digests per commit and file. It holds
 * the state between chunks, so use one instance per log.
 */
export class PatchDigester {
  #tail = "";
  readonly #paths: ReadonlySet<string>;
  readonly #commits = new Map<string, Map<string, FileDigest>>();
  #commit: Map<string, FileDigest> | undefined;
  #file: OpenFile | undefined;

  /** `paths` are the only files that are digested. */
  constructor(paths: ReadonlySet<string>) {
    this.#paths = paths;
  }

  /** Consumes the next piece of output. */
  push(chunk: string): void {
    const lines = (this.#tail + chunk).split("\n");
    this.#tail = lines.pop() ?? "";
    for (const line of lines) {
      this.#consume(line);
    }
  }

  /** Returns the digests of every commit read; call once after the final `push`. */
  end(): ReadonlyMap<string, CommitDigests> {
    if (this.#tail !== "") {
      this.#consume(this.#tail);
      this.#tail = "";
    }
    this.#closeFile();
    return this.#commits;
  }

  #closeFile(): void {
    const file = this.#file;
    this.#file = undefined;
    if (file === undefined || this.#commit === undefined) {
      return;
    }
    const digest = finish(file);
    // a path twice in one commit (a change of type) cannot be told apart
    this.#commit.set(
      file.path,
      this.#commit.has(file.path) ? { ...digest, comparable: false } : digest,
    );
  }

  #consume(line: string): void {
    const file = this.#file;
    if (
      file?.inHunk === true &&
      !line.startsWith(COMMIT) &&
      !line.startsWith(FILE)
    ) {
      this.#consumeHunkLine(file, line);
    } else if (line.startsWith(COMMIT)) {
      this.#closeFile();
      this.#commit = new Map();
      this.#commits.set(line.slice(COMMIT.length).trim(), this.#commit);
    } else if (line.startsWith(FILE)) {
      this.#closeFile();
      this.#open(line);
    } else if (file !== undefined) {
      this.#consumeHeaderLine(file, line);
    }
  }

  #open(line: string): void {
    const path = pathOfHeader(line);
    if (path === undefined || !this.#paths.has(path)) {
      return;
    }
    this.#file = {
      path,
      forward: new LineHash(),
      reverse: new LineHash(),
      deleted: [],
      added: [],
      last: undefined,
      inHunk: false,
      blobs: undefined,
      binary: false,
      lossy: false,
    };
  }

  #consumeHeaderLine(file: OpenFile, line: string): void {
    const index = INDEX.exec(line);
    if (index !== null) {
      file.blobs = { old: index[1] ?? "", new: index[2] ?? "" };
    } else if (line.startsWith("Binary files ")) {
      file.binary = true;
    } else if (line.startsWith("@@")) {
      file.inHunk = true;
    }
  }

  #consumeHunkLine(file: OpenFile, line: string): void {
    const kind = line.slice(0, 1);
    if (kind === "+" || kind === "-") {
      file.last = kind === "+" ? file.added : file.deleted;
      file.last.push(line.slice(1));
      file.lossy ||= line.includes(REPLACEMENT);
    } else if (kind === "\\") {
      file.last?.push("\\");
    } else {
      flushGroup(file);
    }
  }
}
