import { describe, expect, it } from "vitest";

import {
  boundaryMove,
  boundaryPairMove,
  boundaryPairVerdict,
  boundaryVerdict,
  cliqueMove,
  couplingMove,
  hotspotMove,
  hubMove,
} from "./moves.js";

const A = "packages/compiler/src/template/a.ts";
const B = "packages/core/src/render3/b.ts";

/** Every sentence the words build around paths, with the paths they were given. */
const SENTENCES: ReadonlyArray<readonly [string, string]> = [
  ["boundary move", boundaryMove(A, B)],
  ["boundary pair move", boundaryPairMove(A, B)],
  ["boundary pair verdict", boundaryPairVerdict(A, B, false)],
  ["eroding boundary pair verdict", boundaryPairVerdict(A, B, true)],
  ["boundary verdict", boundaryVerdict(true)],
  ["hotspot move", hotspotMove([A, B])],
  ["clique move", cliqueMove([A, B, "x/y/z.ts"])],
  ["hub move", hubMove(A)],
  ["coupling move", couplingMove(A, B)],
];

/** The text after the label that a reader may capitalize ("Move a boundary: …" gives the "…"). */
const afterLabel = (sentence: string): string =>
  sentence.includes(": ")
    ? sentence.slice(sentence.indexOf(": ") + 2)
    : sentence;

describe("the words of an entry point", () => {
  it.each(SENTENCES)(
    "never opens a sentence with a path, so that capitalizing it keeps the path intact: %s",
    (_name, sentence) => {
      for (const path of [A, B, "x/y/z.ts"]) {
        expect(sentence.startsWith(path)).toBe(false);
        expect(afterLabel(sentence).startsWith(path)).toBe(false);
      }
    },
  );

  it("names a hidden coupling's files after saying what they are", () => {
    expect(couplingMove(A, B)).toBe(
      `Centralize a contract: the files ${A} and ${B} agree on something that neither shows to the other; define it once, in a place both use.`,
    );
  });
});
