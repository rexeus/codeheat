import { describe, expect, it } from "vitest";

import { PatchDigester } from "./patch-digest.js";

const digests = (
  chunks: ReadonlyArray<string>,
  paths: ReadonlyArray<string> = ["x.ts", "y.ts", "i.png"],
) => {
  const digester = new PatchDigester(new Set(paths));
  for (const chunk of chunks) {
    digester.push(chunk);
  }
  return digester.end();
};

const patch = (sha: string, ...files: ReadonlyArray<string>) =>
  `commit ${sha}\n\n${files.join("")}`;

const file = (path: string, ...body: ReadonlyArray<string>) =>
  `diff --git a/${path} b/${path}\nindex 1111..2222 100644\n--- a/${path}\n+++ b/${path}\n${body.join("")}`;

const binary = (sha: string, from: string, to: string) =>
  patch(
    sha,
    `diff --git a/i.png b/i.png\nindex ${from}..${to} 100644\nBinary files a/i.png and b/i.png differ\n`,
  );

const quoted = (escaped: string) =>
  `diff --git "a/${escaped}" "b/${escaped}"\nindex 1111..2222 100644\n--- "a/${escaped}"\n+++ "b/${escaped}"\n@@ -1 +1 @@\n-a\n+b\n`;

describe("PatchDigester", () => {
  it("gives a patch and its exact reverse matching digests", () => {
    const change = patch(
      "a",
      file("x.ts", "@@ -1,2 +1,2 @@\n keep\n-old\n+new\n"),
    );
    const undo = patch(
      "b",
      file("x.ts", "@@ -1,2 +1,2 @@\n keep\n-new\n+old\n"),
    );

    const read = digests([change, undo]);

    expect(read.get("b")?.get("x.ts")?.forward).toBe(
      read.get("a")?.get("x.ts")?.reverse,
    );
    expect(read.get("a")?.get("x.ts")?.forward).not.toBe(
      read.get("a")?.get("x.ts")?.reverse,
    );
  });

  it("tells a patch of the same size but other content from the reverse", () => {
    const change = patch("a", file("x.ts", "@@ -1 +1 @@\n-two\n+three\n"));
    const other = patch("b", file("x.ts", "@@ -1 +1 @@\n-three\n+four\n"));

    const read = digests([change, other]);

    expect(read.get("b")?.get("x.ts")?.forward).not.toBe(
      read.get("a")?.get("x.ts")?.reverse,
    );
  });

  it("reads the same digests however the output is split into chunks", () => {
    const text = patch(
      "a",
      file("x.ts", "@@ -1 +1 @@\n-two\n+three\n\\ No newline at end of file\n"),
      file("y.ts", "@@ -0,0 +1 @@\n+new\n"),
    );

    expect(digests(text.split(""))).toStrictEqual(digests([text]));
  });

  it("compares a binary file by the blobs on either side", () => {
    const read = digests([
      binary("a", "aaaa", "bbbb"),
      binary("b", "bbbb", "aaaa"),
    ]);

    expect(read.get("b")?.get("i.png")?.forward).toBe(
      read.get("a")?.get("i.png")?.reverse,
    );
  });

  it("keeps a line of content that looks like a header as content", () => {
    const read = digests([
      patch(
        "a",
        file("x.ts", "@@ -1 +1 @@\n-commit abc\n+diff --git a/z b/z\n"),
      ),
    ]);

    expect([...(read.get("a")?.keys() ?? [])]).toStrictEqual(["x.ts"]);
  });
});

describe("PatchDigester with unusual input", () => {
  it("skips the files it was not asked for", () => {
    const text = patch(
      "a",
      file("lock.json", "@@ -1 +1 @@\n-a\n+b\n"),
      file("x.ts", "@@ -1 +1 @@\n-a\n+b\n"),
    );

    expect([...(digests([text]).get("a")?.keys() ?? [])]).toStrictEqual([
      "x.ts",
    ]);
  });

  it("digests a group of far more lines than an argument list takes", () => {
    const lines = 200_000;
    const body = `@@ -1,${lines} +1,${lines} @@\n${"-old\n".repeat(lines)}${"+new\n".repeat(lines)}`;
    const undo = `@@ -1,${lines} +1,${lines} @@\n${"-new\n".repeat(lines)}${"+old\n".repeat(lines)}`;

    const read = digests([
      patch("a", file("x.ts", body)),
      patch("b", file("x.ts", undo)),
    ]);

    expect(read.get("b")?.get("x.ts")?.forward).toBe(
      read.get("a")?.get("x.ts")?.reverse,
    );
  });

  it("reads quoted paths with an escaped quote or tab", () => {
    const text = patch("a", quoted('q\\"z.ts'), quoted("t\\tz.ts"));

    const read = digests([text], ['q"z.ts', "t\tz.ts"]);

    expect([...(read.get("a")?.keys() ?? [])].toSorted()).toStrictEqual([
      'q"z.ts',
      "t\tz.ts",
    ]);
  });

  it("does not stand for a file whose changed lines did not decode", () => {
    const read = digests([
      patch("a", file("x.ts", "@@ -1 +1 @@\n-caf\uFFFD\n+caf\uFFFD\n")),
    ]);

    expect(read.get("a")?.get("x.ts")?.comparable).toBe(false);
  });

  it("does not stand for a path that appears twice in a commit", () => {
    const read = digests([
      patch(
        "a",
        file("x.ts", "@@ -1 +0,0 @@\n-a\n"),
        file("x.ts", "@@ -0,0 +1 @@\n+b\n"),
      ),
    ]);

    expect(read.get("a")?.get("x.ts")?.comparable).toBe(false);
  });
});
