import { describe, expect, it } from "vitest";

import { tokenize } from "./tokenize.js";

describe("tokenize", () => {
  it("keeps identifiers and keywords and drops whitespace and punctuation", () => {
    expect(tokenize("export const total = add(a, b);")).toEqual([
      "export",
      "const",
      "total",
      "add",
      "a",
      "b",
    ]);
  });

  it("reads two layouts of the same code as the same words", () => {
    expect(tokenize("if (a) {\n    run();\n}\n")).toEqual(
      tokenize("if(a){run();}"),
    );
  });

  it("reads every string literal as one word, whatever it says", () => {
    expect(tokenize(`say("hello there", 'bye', \`a \${b} c\`)`)).toEqual([
      "say",
      '"',
      '"',
      '"',
    ]);
  });

  it("reads every number as one word, whatever its value", () => {
    expect(tokenize("x = 1_000 + 0xff + 7")).toEqual(["x", "0", "0", "0"]);
  });
});

describe("tokenize comments and quotes", () => {
  it("drops line comments, block comments, and markup comments", () => {
    const text = [
      "a(); // trailing note",
      "/* block",
      "   spanning lines */ b();",
      "<!-- markup note --><p>c</p>",
    ].join("\n");

    expect(tokenize(text)).toEqual(["a", "b", "p", "c", "p"]);
  });

  it("drops a hash comment at the start of a line but keeps a private field", () => {
    const text =
      "# note about the file\nclass A {\n  #secret = 1;\n}\n#!/bin/sh\n";

    expect(tokenize(text)).toEqual(["class", "A", "secret", "0"]);
  });

  it("keeps a comment marker inside a string as part of the string", () => {
    expect(tokenize('url = "https://example.com/x" // note')).toEqual([
      "url",
      '"',
    ]);
  });

  it("ends a quoted string at the end of its line, so a stray apostrophe swallows nothing else", () => {
    expect(tokenize("fn f(x: &'a str) {\n  run();\n}")).toEqual([
      "fn",
      "f",
      "x",
      '"',
      "run",
    ]);
  });

  it("lets a backtick string span lines and honors escapes", () => {
    expect(tokenize("a(`one\ntwo \\` still`); b()")).toEqual(["a", '"', "b"]);
  });

  it("reads an unterminated block comment to the end of the text", () => {
    expect(tokenize("a(); /* never closed\nb();")).toEqual(["a"]);
  });

  it("returns no words for empty text", () => {
    expect(tokenize("")).toEqual([]);
  });
});
