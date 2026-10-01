// Owns reading `git log -z --raw --numstat` output, incrementally.
//
// The log is requested with `--format=%x01%H%x00%ct`. Each commit then
// arrives as NUL-terminated tokens:
//   \u0001<sha> NUL <unix time> NUL [\n]<raw entries><numstat entries>
// A raw entry is `:<modes> <ids> <status>` followed by one path token, or two
// (old and new) for a rename or copy; it tells which files the commit adds and
// deletes.
// A numstat entry is `<added>\t<deleted>\t<path>`. A rename entry has an
// empty path after the counts and is followed by two more tokens, the old and
// the new path. Binary files show `-` for counts.

/** One file touched by a commit. */
type Change = {
  /** Path after the commit (the new path of a rename). */
  readonly path: string;
  /** Set when the commit renamed the file. */
  readonly renamedFrom?: string;
  /** Set when the commit deletes the file; a rename's old path is not a deletion. */
  readonly removed?: true;
  /** Set when the commit adds the file; a rename's new path is not an addition. */
  readonly created?: true;
  /** The object id of the content a deletion removed or an addition created. */
  readonly blob?: string;
  /** 0 for binary files. */
  readonly added: number;
  readonly deleted: number;
};

export type Commit = {
  readonly sha: string;
  /** Commit time in seconds since the epoch. */
  readonly time: number;
  readonly changes: ReadonlyArray<Change>;
};

/** Arguments that make `git log` print what `LogParser` reads. */
export const LOG_FORMAT_ARGS = [
  "--no-merges",
  "-M",
  "--raw",
  // Full object ids: an abbreviated one gains `...` under GIT_PRINT_SHA1_ELLIPSIS.
  "--no-abbrev",
  "--numstat",
  "-z",
  "--no-show-signature",
  "--format=%x01%H%x00%ct",
] as const;

const COMMIT_MARKER = "\u0001";
const NUMSTAT = /^(\d+|-)\t(\d+|-)\t(.*)$/su;
const RAW_STATUS =
  /^:\d+ \d+ ([0-9a-f]+)(?:\.{3})? ([0-9a-f]+)(?:\.{3})? ([A-Z])\d*$/u;

type Phase = "entry" | "time" | "rawPath" | "renamedFrom" | "renamedTo";

type OpenCommit = { sha: string; time: number; changes: Array<Change> };

const lineCount = (field: string | undefined): number =>
  field === undefined || field === "-" ? 0 : Number(field);

/**
 * Turns chunks of log output into commits. It holds the state between
 * chunks, so use one instance per log.
 */
export class LogParser {
  #tail = "";
  #phase: Phase = "entry";
  #open: OpenCommit | undefined;
  #counts = { added: 0, deleted: 0 };
  #renamedFrom = "";
  /** What the open commit adds or deletes, per path, from its raw entries. */
  #marks = new Map<string, Pick<Change, "removed" | "created" | "blob">>();
  #rawPaths = 0;
  #rawStatus = "";
  #rawBlobs = { old: "", new: "" };

  /** Consumes the next piece of output and returns the commits it completed. */
  push(chunk: string): ReadonlyArray<Commit> {
    const tokens = (this.#tail + chunk).split("\0");
    this.#tail = tokens.pop() ?? "";
    return tokens.flatMap((token) => this.#consume(token));
  }

  /** Returns the last commit; call once after the final `push`. */
  end(): ReadonlyArray<Commit> {
    const last = this.#tail === "" ? [] : this.#consume(this.#tail);
    this.#tail = "";
    return [...last, ...this.#close()];
  }

  #consume(token: string): ReadonlyArray<Commit> {
    if (this.#phase === "time") {
      return this.#readTime(token);
    }
    if (this.#phase === "rawPath") {
      this.#readRawPath(token);
      return [];
    }
    if (this.#phase === "renamedFrom") {
      this.#renamedFrom = token;
      this.#phase = "renamedTo";
      return [];
    }
    if (this.#phase === "renamedTo") {
      return this.#readRenamedTo(token);
    }
    return token.startsWith(COMMIT_MARKER)
      ? this.#begin(token.slice(COMMIT_MARKER.length))
      : this.#readEntry(token);
  }

  #readRenamedTo(path: string): ReadonlyArray<Commit> {
    this.#open?.changes.push({
      path,
      renamedFrom: this.#renamedFrom,
      ...this.#counts,
    });
    this.#phase = "entry";
    return [];
  }

  #close(): ReadonlyArray<Commit> {
    const finished = this.#open;
    this.#open = undefined;
    return finished === undefined ? [] : [finished];
  }

  #begin(sha: string): ReadonlyArray<Commit> {
    const finished = this.#close();
    this.#open = { sha, time: 0, changes: [] };
    this.#marks = new Map();
    this.#phase = "time";
    return finished;
  }

  #readTime(token: string): ReadonlyArray<Commit> {
    if (this.#open !== undefined) {
      this.#open.time = Number(token);
    }
    this.#phase = "entry";
    return [];
  }

  #readRawPath(path: string): void {
    if (this.#rawStatus === "D") {
      this.#marks.set(path, { removed: true, blob: this.#rawBlobs.old });
    } else if (this.#rawStatus === "A") {
      this.#marks.set(path, { created: true, blob: this.#rawBlobs.new });
    }
    this.#rawPaths -= 1;
    if (this.#rawPaths === 0) {
      this.#phase = "entry";
    }
  }

  #readEntry(token: string): ReadonlyArray<Commit> {
    const entry = token.replace(/^\n/u, "");
    const raw = RAW_STATUS.exec(entry);
    const status = raw?.[3];
    if (raw !== null && status !== undefined) {
      this.#rawBlobs = { old: raw[1] ?? "", new: raw[2] ?? "" };
      this.#rawStatus = status;
      this.#rawPaths = status === "R" || status === "C" ? 2 : 1;
      this.#phase = "rawPath";
      return [];
    }
    const match = NUMSTAT.exec(entry);
    if (this.#open === undefined || match === null) {
      return [];
    }
    const [, added, deleted, path = ""] = match;
    this.#counts = { added: lineCount(added), deleted: lineCount(deleted) };
    if (path === "") {
      this.#phase = "renamedFrom";
    } else {
      this.#open.changes.push({
        path,
        ...this.#counts,
        ...this.#marks.get(path),
      });
    }
    return [];
  }
}
