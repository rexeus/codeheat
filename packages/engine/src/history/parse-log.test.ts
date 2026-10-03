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

describe("LogParser deletions", () => {
  // Real `git log -z --raw --numstat` output: the raw entries precede the numstat entries.
  it("marks the file a commit deletes and the one it adds with the content, and not a modified or renamed one", () => {
    const raw =
      "\u0001d\u00007\0\n" +
      ":100644 100644 f00c965 f00c965 R100\0old.ts\0new.ts\0" +
      ":000000 100644 0000000 30bf1cc A\0added.ts\0" +
      ":100644 000000 587be6b 0000000 D\0dir/gone.ts\0" +
      ":100644 100644 3e75765 337b506 M\0edited.ts\0" +
      "0\t0\t\0old.ts\0new.ts\0" +
      "11\t0\tadded.ts\0" +
      "0\t7\tdir/gone.ts\0" +
      "1\t1\tedited.ts\0";

    expect(parse([raw])[0]?.changes).toStrictEqual([
      { path: "new.ts", renamedFrom: "old.ts", added: 0, deleted: 0 },
      {
        path: "added.ts",
        added: 11,
        deleted: 0,
        created: true,
        blob: "30bf1cc",
      },
      {
        path: "dir/gone.ts",
        added: 0,
        deleted: 7,
        removed: true,
        blob: "587be6b",
      },
      { path: "edited.ts", added: 1, deleted: 1 },
    ]);
  });

  it("does not carry a deletion or an addition over to the next commit's file of the same name", () => {
    const raw =
      "\u0001e\u00002\0\n:100644 000000 587be6b 0000000 D\0a.ts\0" +
      "0\t3\ta.ts\0" +
      "\u0001f\u00001\0\n:000000 100644 0000000 587be6b A\0a.ts\0" +
      "3\t0\ta.ts\0";

    expect(parse([raw]).map(({ changes }) => changes)).toStrictEqual([
      [{ path: "a.ts", added: 0, deleted: 3, removed: true, blob: "587be6b" }],
      [{ path: "a.ts", added: 3, deleted: 0, created: true, blob: "587be6b" }],
    ]);
  });

  it("reads raw entries whose object ids end with an ellipsis", () => {
    const raw =
      "\u0001g\u00003\0\n" +
      ":100644 000000 587be6b... 0000000... D\0gone.ts\0" +
      ":100644 100644 3e75765... 337b506... M\0edited.ts\0" +
      "0\t7\tgone.ts\0" +
      "1\t1\tedited.ts\0";

    expect(parse([raw])[0]?.changes).toStrictEqual([
      { path: "gone.ts", added: 0, deleted: 7, removed: true, blob: "587be6b" },
      { path: "edited.ts", added: 1, deleted: 1 },
    ]);
  });
});

describe("LogParser chunking", () => {
  it("yields the same commits however the output is split into chunks", () => {
    const raw =
      "\u0001aaa\u0000200\0\n" +
      ":100644 100644 3e75765 337b506 M\0src/a.ts\0" +
      ":100644 100644 f00c965 f00c965 R100\0old.ts\0new.ts\0" +
      "3\t1\tsrc/a.ts\0" +
      "2\t1\t\0old.ts\0new.ts\0" +
      "\u0001bbb\u0000100\0\n" +
      ":100644 000000 587be6b 0000000 D\0logo.png\0" +
      "-\t-\tlogo.png\0";

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
