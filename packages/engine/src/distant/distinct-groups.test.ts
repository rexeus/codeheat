import { describe, expect, it } from "vitest";

import { distinctGroups } from "./distinct-groups.js";

const group = (modules: string, sharedCommits: number) => ({
  modules: modules.split(" "),
  sharedCommits,
});

const names = (groups: ReadonlyArray<{ modules: ReadonlyArray<string> }>) =>
  groups.map(({ modules }) => modules.join(" "));

/** Every pair of modules is linked. */
const allLinked = () => true;

/** The pairs named as `"a b"` are not linked, any other pair is. */
const unlinked =
  (...pairs: ReadonlyArray<string>) =>
  (a: string, b: string): boolean =>
    !pairs.includes(`${a} ${b}`) && !pairs.includes(`${b} ${a}`);

const members = (from: number, to: number): string =>
  Array.from({ length: to - from + 1 }, (_, index) => `m${from + index}`).join(
    " ",
  );

describe("distinctGroups variants", () => {
  it("keeps only the stronger of two groups that share all but one member when their union is linked", () => {
    expect(
      names(distinctGroups([group("a b c", 4), group("b c d", 9)], allLinked)),
    ).toEqual(["b c d"]);
  });

  it("breaks a tie in commits by size and then by path", () => {
    expect(
      names(distinctGroups([group("b c d", 5), group("a b c", 5)], allLinked)),
    ).toEqual(["a b c"]);
    expect(
      names(
        distinctGroups([group("b c d e", 5), group("a b c d", 5)], allLinked),
      ),
    ).toEqual(["a b c d"]);
  });

  it("keeps near-duplicate large groups once when they share nine of eleven and their union is linked", () => {
    const larger = group(members(1, 11), 5);
    const smaller = group(members(3, 11).concat(" x1"), 7);

    expect(smaller.modules).toHaveLength(10);
    expect(names(distinctGroups([larger, smaller], allLinked))).toEqual([
      smaller.modules.join(" "),
    ]);
  });

  it("keeps two large groups that share fewer than four fifths of the larger", () => {
    const first = group(members(1, 10), 5);
    const second = group(members(4, 10).concat(" x1 x2 x3"), 4);

    expect(names(distinctGroups([first, second], allLinked))).toHaveLength(2);
  });
});

describe("distinctGroups distinct units", () => {
  it("keeps two groups that overlap but whose other members never change together", () => {
    expect(
      names(
        distinctGroups([group("a b c", 5), group("b c d", 4)], unlinked("a d")),
      ),
    ).toEqual(["a b c", "b c d"]);
  });

  it("keeps the three groups that share a core pair but each add a module of their own", () => {
    const groups = [
      group("api core web", 9),
      group("api core mobile", 6),
      group("admin api core", 5),
    ];

    expect(
      names(
        distinctGroups(
          groups,
          unlinked("web mobile", "web admin", "mobile admin"),
        ),
      ),
    ).toEqual(["api core web", "api core mobile", "admin api core"]);
  });

  it("keeps two groups that share a single module, or none", () => {
    expect(
      names(distinctGroups([group("a b c", 5), group("c d e", 4)], allLinked)),
    ).toEqual(["a b c", "c d e"]);
    expect(
      names(distinctGroups([group("a b c", 5), group("d e f", 4)], allLinked)),
    ).toEqual(["a b c", "d e f"]);
  });

  it("drops a group inside another even when it is stronger", () => {
    expect(
      names(
        distinctGroups([group("a b c", 9), group("a b c d", 4)], allLinked),
      ),
    ).toEqual(["a b c d"]);
  });

  it("judges a variant against the groups kept, not against dropped ones", () => {
    // b c d is a variant of a b c (dropped); c d e shares only one member with a b c.
    expect(
      names(
        distinctGroups(
          [group("a b c", 9), group("b c d", 8), group("c d e", 7)],
          allLinked,
        ),
      ),
    ).toEqual(["a b c", "c d e"]);
  });
});
