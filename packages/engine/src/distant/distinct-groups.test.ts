import { describe, expect, it } from "vitest";

import { distinctGroups } from "./distinct-groups.js";

const group = (modules: string, sharedCommits: number) => ({
  modules: modules.split(" "),
  sharedCommits,
});

const namesOf = (groups: ReadonlyArray<{ modules: ReadonlyArray<string> }>) =>
  groups.map(({ modules }) => modules.join(" "));

describe("distinctGroups", () => {
  it("keeps only the stronger of two groups that share all but one member", () => {
    expect(
      namesOf(distinctGroups([group("a b c", 4), group("b c d", 9)])),
    ).toEqual(["b c d"]);
  });

  it("breaks a tie in commits by path", () => {
    expect(
      namesOf(distinctGroups([group("b c d", 5), group("a b c", 5)])),
    ).toEqual(["a b c"]);
    expect(
      namesOf(distinctGroups([group("b c d e", 5), group("a b c d", 5)])),
    ).toEqual(["a b c d"]);
  });

  it("keeps two groups that share fewer members", () => {
    expect(
      namesOf(distinctGroups([group("a b c", 5), group("c d e", 4)])),
    ).toEqual(["a b c", "c d e"]);
    expect(
      namesOf(distinctGroups([group("a b c", 5), group("d e f", 4)])),
    ).toEqual(["a b c", "d e f"]);
  });

  it("drops a group inside another even when it is stronger", () => {
    expect(
      namesOf(distinctGroups([group("a b c", 9), group("a b c d", 4)])),
    ).toEqual(["a b c d"]);
  });

  it("judges a variant against the groups kept, not against dropped ones", () => {
    // b c d is a variant of a b c (dropped); c d e shares only two of its members with a b c.
    expect(
      namesOf(
        distinctGroups([
          group("a b c", 9),
          group("b c d", 8),
          group("c d e", 7),
        ]),
      ),
    ).toEqual(["a b c", "c d e"]);
  });
});
