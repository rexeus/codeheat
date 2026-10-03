import { describe, expect, it } from "vitest";

import { scanDependencies } from "./typescript-dependencies.js";

describe("scanDependencies statements", () => {
  it("finds the specifier of every kind of import and re-export", () => {
    const source = [
      'import a from "./a";',
      "import { b } from './b.js';",
      'import type { C } from "./c";',
      'import * as d from "pkg/d";',
      'import "./side-effect";',
      'export * from "./e";',
      "export { f } from './f';",
      'export type { G } from "./g";',
    ].join("\n");

    expect(scanDependencies(source)).toEqual([
      "./a",
      "./b.js",
      "./c",
      "pkg/d",
      "./e",
      "./f",
      "./g",
      "./side-effect",
    ]);
  });

  it("reads a statement that spans lines, with a comment between its names", () => {
    const source = [
      "export {",
      "  First,",
      "  // it's not used outside this package",
      "  Second as Other,",
      '} from "./names";',
    ].join("\n");

    expect(scanDependencies(source)).toEqual(["./names"]);
  });

  it("lists a specifier once however often it is loaded", () => {
    const source = 'import { a } from "./x";\nimport type { B } from "./x";\n';

    expect(scanDependencies(source)).toEqual(["./x"]);
  });
});

describe("scanDependencies calls and look-alikes", () => {
  it("finds require and import calls with a plain string, indented or inline", () => {
    const source = [
      'const a = require("./a");',
      "async function load() {",
      '  return import("./lazy").then((m) => m.default);',
      "}",
    ].join("\n");

    expect(scanDependencies(source)).toEqual(["./a", "./lazy"]);
  });

  it("ignores calls whose argument is not a plain string", () => {
    const source = "const a = require(name);\nconst b = import(`./${x}`);\n";

    expect(scanDependencies(source)).toEqual([]);
  });

  it("ignores imports inside comments", () => {
    const source = [
      '// import { old } from "./old";',
      "/*",
      ' * import { sample } from "./sample";',
      " */",
      'import { real } from "./real"; // see https://example.com/x',
    ].join("\n");

    expect(scanDependencies(source)).toEqual(["./real"]);
  });

  it("does not take an export of a string for a re-export", () => {
    const source =
      "export const label = 'from';\nexport const text = \"data from 'x'\";\n";

    expect(scanDependencies(source)).toEqual([]);
  });

  it("finds nothing in a file without imports", () => {
    expect(scanDependencies("export const answer = 42;\n")).toEqual([]);
  });
});

describe("scanDependencies strings and patterns", () => {
  it("does not let a glob in a string open a comment that swallows the imports after it", () => {
    const source = [
      'const files = "src/*.ts";',
      "const base = '/api/*';",
      'import { a } from "./a";',
      "/* a real comment */",
      'import { b } from "./b";',
    ].join("\n");

    expect(scanDependencies(source)).toEqual(["./a", "./b"]);
  });

  it("does not cut a line at slashes inside a string, and keeps a URL in an import", () => {
    const source = [
      'const label = "a // b";',
      'import { c } from "./c";',
      'import d from "https://example.com/d.js";',
    ].join("\n");

    expect(scanDependencies(source)).toEqual([
      "./c",
      "https://example.com/d.js",
    ]);
  });

  it("keeps the imports after a template literal that holds comment markers", () => {
    const source = [
      "const text = `/* not a comment // either`;",
      'import { e } from "./e";',
    ].join("\n");

    expect(scanDependencies(source)).toEqual(["./e"]);
  });

  it("does not let a quote or backtick in a regular expression open a string", () => {
    const source = [
      "const quote = /`/g;",
      'const strip = text.replace(/\'/g, "");',
      'import { f } from "./f";',
      "const note = `after`;",
    ].join("\n");

    expect(scanDependencies(source)).toEqual(["./f"]);
  });

  it("still drops a comment that follows code on the same line", () => {
    const source = 'import { g } from "./g"; // import { h } from "./h";\n';

    expect(scanDependencies(source)).toEqual(["./g"]);
  });
});
