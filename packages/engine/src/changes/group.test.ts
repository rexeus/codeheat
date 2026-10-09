import { describe, expect, it } from "vitest";

import { groupChanges } from "./group.js";
import type { Candidate } from "./group.js";

const DAY = 24 * 60 * 60;

/** A commit on `day` that touched the file ids `files`. */
const commit = (
  sha: string,
  subject: string,
  day: number,
  files: ReadonlyArray<number>,
): Candidate => ({
  sha,
  subject,
  time: day * DAY,
  files: Uint32Array.from(files),
  previousLives: new Uint32Array(0),
  size: files.length,
});

/** The commit, also touching `previous` in earlier lives. */
const withPreviousLives = (
  candidate: Candidate,
  previous: ReadonlyArray<number>,
): Candidate => ({
  ...candidate,
  previousLives: Uint32Array.from(previous),
  size: candidate.size + previous.length,
});

const filesOf = (changes: ReturnType<typeof groupChanges>["changes"]) =>
  changes.map(({ files }) => [...files].toSorted((a, b) => a - b));

const sequence = (count: number, subject: string, day = 0) =>
  Array.from({ length: count }, (_, index) =>
    commit(`c${index}`, subject, day, [index]),
  );

const range = (from: number, length: number) =>
  Array.from({ length }, (_, index) => from + index);

/** The kind each change of one pull request's commits, whose subjects are `subjects`, ends up with. */
const kindsOf = (...subjects: ReadonlyArray<string>) =>
  groupChanges(
    subjects.map((subject, index) =>
      commit(`c${index}`, `${subject} (#1)`, index, [index]),
    ),
    new Map(),
  ).changes.map(({ subjectKind }) => subjectKind);

describe("groupChanges subject kinds", () => {
  it("reads what the subjects of the commits of a change say: a fix needs more than half of them", () => {
    expect(kindsOf("fix: a", "fix: b", "feat: c")).toStrictEqual(["fix"]);
    expect(kindsOf("feat: a", "fix: typo", "feat: b")).toStrictEqual([
      "convention",
    ]);
    expect(kindsOf("add a")).toStrictEqual(["other"]);
  });
});

describe("groupChanges by pull request", () => {
  it("joins commits with one pull request suffix into a change of the union of their files", () => {
    const grouping = groupChanges(
      [
        commit("c", "fix (#3)", 3, [1, 2]),
        commit("b", "more (#3)", 2, [2, 3]),
        commit("a", "other (#4)", 1, [9]),
      ],
      new Map(),
    );

    expect(filesOf(grouping.changes)).toStrictEqual([[1, 2, 3], [9]]);
    expect(grouping).toMatchObject({ by: "pr", largest: 2 });
  });

  it("joins commits that one merge commit brought in, whatever their subjects say", () => {
    const grouping = groupChanges(
      [
        commit("c", "third", 3, [3]),
        commit("b", "second", 2, [2]),
        commit("a", "first", 1, [1]),
      ],
      new Map([
        ["c", "m"],
        ["b", "m"],
      ]),
    );

    expect(filesOf(grouping.changes)).toStrictEqual([[2, 3], [1]]);
    expect(grouping.by).toBe("pr");
  });

  it("prefers the suffix over the merge of a commit, so a merge of squashed work joins nothing", () => {
    const grouping = groupChanges(
      [commit("b", "y (#2)", 2, [2]), commit("a", "x (#1)", 1, [1])],
      new Map([
        ["a", "m"],
        ["b", "m"],
      ]),
    );

    expect(filesOf(grouping.changes)).toStrictEqual([[2], [1]]);
    expect(grouping.by).toBe("commit");
  });

  it("sizes a change by the files of earlier lives too, each counted once", () => {
    const { changes } = groupChanges(
      [
        withPreviousLives(commit("b", "y (#1)", 2, [1]), [7, 8]),
        withPreviousLives(commit("a", "x (#1)", 1, [1, 2]), [7]),
      ],
      new Map(),
    );

    expect(changes).toHaveLength(1);
    expect(changes[0]?.size).toBe(4);
    expect(filesOf(changes)).toStrictEqual([[1, 2]]);
  });
});

describe("groupChanges limits of a pull request", () => {
  it("keeps the commits of a pull request apart when it holds more than the limit", () => {
    const grouping = groupChanges(sequence(31, "work (#1)"), new Map());

    expect(grouping.changes).toHaveLength(31);
    expect(grouping).toMatchObject({ by: "commit", largest: 1 });
  });

  it("splits a suffix group that spans more than 14 days of its first commit", () => {
    const grouping = groupChanges(
      [
        commit("c", "again (#1)", 30, [3]),
        commit("b", "tidy (#1)", 14, [2]),
        commit("a", "work (#1)", 0, [1]),
      ],
      new Map(),
    );

    expect(filesOf(grouping.changes)).toStrictEqual([[3], [1, 2]]);
  });

  it("does not limit the span of the commits one merge brought in", () => {
    const grouping = groupChanges(
      [commit("b", "late", 60, [2]), commit("a", "early", 0, [1])],
      new Map([
        ["a", "m/1"],
        ["b", "m/1"],
      ]),
    );

    expect(filesOf(grouping.changes)).toStrictEqual([[1, 2]]);
  });

  it("keeps a pull request of exactly the limit together", () => {
    expect(groupChanges(sequence(30, "work (#1)"), new Map())).toMatchObject({
      by: "pr",
      largest: 30,
    });
  });
});

describe("groupChanges by ticket", () => {
  it("joins commits of one ticket within 14 days of the first, and starts afresh after that", () => {
    const grouping = groupChanges(
      [
        commit("d", "PROJ-1 d", 20, [4]),
        commit("c", "PROJ-1 c", 15, [3]),
        commit("b", "PROJ-1 b", 14, [2]),
        commit("a", "PROJ-1 a", 0, [1]),
      ],
      new Map(),
    );

    expect(filesOf(grouping.changes)).toStrictEqual([
      [3, 4],
      [1, 2],
    ]);
    expect(grouping.by).toBe("ticket");
  });

  it("keeps different tickets apart", () => {
    const grouping = groupChanges(
      [commit("b", "PROJ-2 b", 2, [2]), commit("a", "PROJ-1 a", 1, [1])],
      new Map(),
    );

    expect(grouping.changes).toHaveLength(2);
  });

  it("reports pull requests and tickets together as mixed", () => {
    const grouping = groupChanges(
      [
        commit("d", "other (#9)", 9, [9]),
        commit("c", "other (#9)", 9, [8]),
        commit("b", "PROJ-1 b", 2, [2]),
        commit("a", "PROJ-1 a", 1, [1]),
      ],
      new Map(),
    );

    expect(grouping).toMatchObject({ by: "mixed", largest: 2 });
    expect(grouping.changes).toHaveLength(2);
  });
});

describe("groupChanges limits of a ticket", () => {
  it("falls back to the pull requests it would join when the change grows past 50 files", () => {
    const grouping = groupChanges(
      [
        commit("b", "PROJ-1 b (#2)", 2, range(100, 26)),
        commit("a2", "PROJ-1 a (#1)", 1, range(0, 26)),
        commit("a1", "PROJ-1 a (#1)", 1, range(0, 26)),
        commit("lone", "unrelated", 1, [500]),
      ],
      new Map(),
    );

    expect(grouping.changes.map(({ size }) => size)).toStrictEqual([26, 26, 1]);
    expect(grouping).toMatchObject({ by: "pr", largest: 2 });
  });

  it("falls back when the ticket spans more commits than the limit", () => {
    const grouping = groupChanges(sequence(31, "PROJ-1 work"), new Map());

    expect(grouping.by).toBe("commit");
  });
});

describe("groupChanges without commits", () => {
  it("reports no change and no largest", () => {
    expect(groupChanges([], new Map())).toStrictEqual({
      changes: [],
      members: [],
      by: "commit",
      largest: 0,
    });
  });
});
