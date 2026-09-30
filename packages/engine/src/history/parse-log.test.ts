import { describe, expect, it } from "vitest";

import { LogParser } from "./parse-log.js";

const parse = (chunks: ReadonlyArray<string>) => {
  const parser = new LogParser();
  return [...chunks.flatMap((chunk) => parser.push(chunk)), ...parser.end()];
};

describe("LogParser changes", () => {
  it("parses commits with their changed files", () => {
    const raw =
      "\u0001aaa\u0000200\0\n3\t1\tsrc/a.ts\0" +
      "0\t5\tsrc/b.ts\0" +
      "\u0001bbb\u0000100\0\n10\t0\tREADME.md\0";

    expect(parse([raw])).toStrictEqual([
      {
        sha: "aaa",
        time: 200,
        changes: [
          { path: "src/a.ts", added: 3, deleted: 1 },
          { path: "src/b.ts", added: 0, deleted: 5 },
        ],
      },
      {
        sha: "bbb",
        time: 100,
        changes: [{ path: "README.md", added: 10, deleted: 0 }],
      },
    ]);
  });

  it("counts a binary file as a change of zero lines", () => {
    expect(parse(["\u0001c\u00005\0\n-\t-\timage.png\0"])).toStrictEqual([
      {
        sha: "c",
        time: 5,
        changes: [{ path: "image.png", added: 0, deleted: 0 }],
      },
    ]);
  });

  it("reads a rename as the new path with the old path it came from", () => {
    const raw =
      "\u0001d\u00007\0\n2\t1\t\0old name.ts\0new.ts\u00004\t0\tother.ts\0";

    expect(parse([raw])).toStrictEqual([
      {
        sha: "d",
        time: 7,
        changes: [
          { path: "new.ts", renamedFrom: "old name.ts", added: 2, deleted: 1 },
          { path: "other.ts", added: 4, deleted: 0 },
        ],
      },
    ]);
  });

  it("keeps a commit without changes", () => {
    const raw = "\u0001e\u00009\0\u0001f\u00008\0\n1\t1\tz.ts\0";

    expect(parse([raw])).toStrictEqual([
      { sha: "e", time: 9, changes: [] },
      { sha: "f", time: 8, changes: [{ path: "z.ts", added: 1, deleted: 1 }] },
    ]);
  });

  it("keeps tabs, newlines, and non-ASCII characters inside a path", () => {
    const raw = "\u0001g\u00001\0\n1\t0\tdir/we\tird\nnäme.ts\0";

    expect(parse([raw])[0]?.changes).toStrictEqual([
      { path: "dir/we\tird\nnäme.ts", added: 1, deleted: 0 },
    ]);
  });
});

describe("LogParser chunking", () => {
  it("yields the same commits however the output is split into chunks", () => {
    const raw =
      "\u0001aaa\u0000200\0\n3\t1\tsrc/a.ts\0" +
      "2\t1\t\0old.ts\0new.ts\0" +
      "\u0001bbb\u0000100\0\n-\t-\tlogo.png\0";

    const whole = parse([raw]);
    const bySingleCharacters = parse(raw.split(""));

    expect(whole).toHaveLength(2);
    expect(bySingleCharacters).toStrictEqual(whole);
  });

  it("returns nothing for empty output", () => {
    expect(parse([])).toStrictEqual([]);
    expect(parse([""])).toStrictEqual([]);
  });
});
