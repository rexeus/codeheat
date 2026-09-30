// Owns reading `git log -z --numstat` output, incrementally.
//
// The log is requested with `--format=%x01%H%x00%ct`. Each commit then
// arrives as NUL-terminated tokens:
//   \u0001<sha> NUL <unix time> NUL [\n]<added>\t<deleted>\t<path> NUL ...
// A rename entry has an empty path after the counts and is followed by two
// more tokens, the old and the new path. Binary files show `-` for counts.

/** One file touched by a commit. */
type Change = {
  /** Path after the commit (the new path of a rename). */
  readonly path: string;
  /** Set when the commit renamed the file. */
  readonly renamedFrom?: string;
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
  "--numstat",
  "-z",
  "--no-show-signature",
  "--format=%x01%H%x00%ct",
] as const;

const COMMIT_MARKER = "\u0001";
const NUMSTAT = /^(\d+|-)\t(\d+|-)\t(.*)$/su;

type Phase = "entry" | "time" | "renamedFrom" | "renamedTo";

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

  #readEntry(token: string): ReadonlyArray<Commit> {
    const match = NUMSTAT.exec(token.replace(/^\n/u, ""));
    if (this.#open === undefined || match === null) {
      return [];
    }
    const [, added, deleted, path = ""] = match;
    this.#counts = { added: lineCount(added), deleted: lineCount(deleted) };
    if (path === "") {
      this.#phase = "renamedFrom";
    } else {
      this.#open.changes.push({ path, ...this.#counts });
    }
    return [];
  }
}
