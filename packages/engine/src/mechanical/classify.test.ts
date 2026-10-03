import { describe, expect, it } from "vitest";

import { classify } from "./classify.js";
import type { Evidence } from "./classify.js";
import type { CommitSignals } from "./signals.js";

const commit = (
  sha: string,
  time: number,
  more: Partial<CommitSignals> = {},
): CommitSignals => ({
  sha,
  time,
  moveOnly: false,
  reverts: undefined,
  touchedPaths: new Set(),
  fileChanges: undefined,
  shape: 0,
  mirror: 0,
  maybeWhitespace: false,
  fingerprint: 0,
  ...more,
});

const noEvidence: Evidence = {
  ignored: new Set(),
  whitespaceOnly: new Set(),
  patchIds: new Map(),
  reLands: new Set(),
  confirmedReverts: new Set(),
};

const kindsOf = (
  window: ReadonlyArray<CommitSignals>,
  evidence: Partial<Evidence> = {},
) => Object.fromEntries(classify(window, { ...noEvidence, ...evidence }));

describe("classify", () => {
  it("gives a commit the first kind that applies: ignored, renames, whitespace", () => {
    const window = [
      commit("a", 3, { moveOnly: true }),
      commit("b", 2, { moveOnly: true }),
      commit("c", 1),
    ];

    expect(
      kindsOf(window, {
        ignored: new Set(["a"]),
        whitespaceOnly: new Set(["a", "b", "c"]),
      }),
    ).toStrictEqual({ a: "ignored", b: "renames", c: "whitespace" });
  });

  it("pairs a revert with the commit it reverts", () => {
    const window = [
      commit("revert", 3, { reverts: "original" }),
      commit("original", 2),
      commit("base", 1),
    ];

    expect(
      kindsOf(window, { confirmedReverts: new Set(["revert"]) }),
    ).toStrictEqual({ revert: "reverts", original: "reverts" });
  });

  it("leaves a revert alone that is not confirmed to undo the commit it names", () => {
    const window = [
      commit("revert", 3, { reverts: "original" }),
      commit("original", 2),
    ];

    expect(kindsOf(window)).toStrictEqual({});
  });

  it("leaves a revert alone whose original is not in the window", () => {
    const window = [
      commit("revert", 3, { reverts: "elsewhere" }),
      commit("base", 1),
    ];

    expect(
      kindsOf(window, { confirmedReverts: new Set(["revert"]) }),
    ).toStrictEqual({});
  });
});

describe("classify reverts of reverts and mechanical originals", () => {
  it("pairs a revert of a revert with the revert and leaves the first commit as the change", () => {
    const window = [
      commit("again", 4, { reverts: "revert" }),
      commit("revert", 3, { reverts: "original" }),
      commit("original", 2),
    ];

    expect(
      kindsOf(window, { confirmedReverts: new Set(["again", "revert"]) }),
    ).toStrictEqual({ again: "reverts", revert: "reverts" });
  });

  it("does not pair a revert with an original that is mechanical for another reason", () => {
    const window = [
      commit("revert", 3, { reverts: "original" }),
      commit("original", 2),
    ];

    expect(
      kindsOf(window, {
        whitespaceOnly: new Set(["original"]),
        confirmedReverts: new Set(["revert"]),
      }),
    ).toStrictEqual({ original: "whitespace" });
  });
});

describe("classify duplicates", () => {
  it("counts a copy that is a re-land of its original", () => {
    const window = [commit("relanded", 2), commit("first", 1)];

    expect(
      kindsOf(window, {
        patchIds: new Map([
          ["relanded", "p"],
          ["first", "p"],
        ]),
        reLands: new Set(["relanded"]),
      }),
    ).toStrictEqual({});
  });

  it("keeps the oldest commit of equal patch ids and marks the rest as duplicates", () => {
    const window = [
      commit("copy2", 3),
      commit("copy1", 2),
      commit("first", 1),
      commit("other", 0),
    ];

    expect(
      kindsOf(window, {
        patchIds: new Map([
          ["copy2", "p"],
          ["copy1", "p"],
          ["first", "p"],
          ["other", "q"],
        ]),
      }),
    ).toStrictEqual({ copy2: "duplicates", copy1: "duplicates" });
  });

  it("keeps the later commit of a tie in time as the older one", () => {
    const window = [commit("newer", 1), commit("older", 1)];

    expect(
      kindsOf(window, {
        patchIds: new Map([
          ["newer", "p"],
          ["older", "p"],
        ]),
      }),
    ).toStrictEqual({ newer: "duplicates" });
  });

  it("does not take a commit that is mechanical already as the original of a duplicate", () => {
    const window = [commit("copy", 2), commit("sweep", 1)];

    expect(
      kindsOf(window, {
        ignored: new Set(["sweep"]),
        patchIds: new Map([
          ["copy", "p"],
          ["sweep", "p"],
        ]),
      }),
    ).toStrictEqual({ sweep: "ignored" });
  });
});
