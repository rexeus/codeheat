import { parseSync } from "oxc-parser";
import { describe, expect, it } from "vitest";

import { typescriptAdapter } from "./typescript-adapter.js";

const adapter = typescriptAdapter(parseSync);
const read = (file: string, source: string) => adapter.exports(file, source);
const bindings = (file: string, source: string) =>
  Object.fromEntries(
    read(file, source)?.names.map(({ name, binding }) => [name, binding]) ?? [],
  );

describe("typescript adapter exported symbols", () => {
  it("lists every kind of declaration and specifier by its exported name", () => {
    const found = read(
      "api.ts",
      [
        "export function run() {}",
        "export const { a, b: [c] } = source;",
        "export class Box {}",
        "export interface Options {}",
        "export type Id = string;",
        "export enum Level {}",
        "const local = 1;",
        "export { local, local as alias };",
      ].join("\n"),
    );

    expect(found?.names.map(({ name }) => name).toSorted()).toStrictEqual([
      "Box",
      "Id",
      "Level",
      "Options",
      "a",
      "alias",
      "c",
      "local",
      "run",
    ]);
    expect(found?.forwarded).toStrictEqual([]);
  });

  it("names the default export default, whatever it is", () => {
    expect(
      read("a.ts", "export default class {}")?.names.map(({ name }) => name),
    ).toStrictEqual(["default"]);
    expect(
      read("b.ts", "const x = 1;\nexport { x as default };")?.names.map(
        ({ name }) => name,
      ),
    ).toStrictEqual(["default"]);
  });
});

describe("typescript adapter re-exported symbols", () => {
  it("counts re-exported names by their exported name and forwards only export-star", () => {
    const found = read(
      "barrel.ts",
      [
        'export * from "./all";',
        'export type * from "./types";',
        'export * as ns from "./namespace";',
        'export { x, y as z } from "pkg";',
        'export { default } from "./d";',
      ].join("\n"),
    );

    expect(found?.names.map(({ name }) => name).toSorted()).toStrictEqual([
      "default",
      "ns",
      "x",
      "z",
    ]);
    expect(found?.forwarded).toStrictEqual(["./all", "./types"]);
  });

  it("counts a name once however often it is exported", () => {
    const found = read(
      "dupes.ts",
      'import { x } from "./x";\nexport { x };\nexport { x as y } from "./x";\nexport { x as y2 } from "./x";\nexport * from "./a";\nexport * from "./a";',
    );

    expect(found?.names.map(({ name }) => name).toSorted()).toStrictEqual([
      "x",
      "y",
      "y2",
    ]);
    expect(found?.forwarded).toStrictEqual(["./a"]);
  });
});

describe("typescript adapter export bindings", () => {
  it("binds a name to the declaration in the file, shared by every name for it", () => {
    expect(
      bindings(
        "a.ts",
        "const x = 1;\nexport { x, x as y };\nexport function f() {}\nexport default 5;",
      ),
    ).toStrictEqual({
      x: { local: "x" },
      y: { local: "x" },
      f: { local: "f" },
      default: { local: "*default*" },
    });
  });

  it("binds a re-exported name to the module and the name it exports there", () => {
    expect(
      bindings(
        "barrel.ts",
        [
          'export { a, b as c } from "./m";',
          'export { default } from "./d";',
          'export * as ns from "./n";',
        ].join("\n"),
      ),
    ).toStrictEqual({
      a: { specifier: "./m", name: "a" },
      c: { specifier: "./m", name: "b" },
      default: { specifier: "./d", name: "default" },
      ns: { specifier: "./n", name: "*" },
    });
  });

  it("binds an exported import to what it imports", () => {
    expect(
      bindings(
        "again.ts",
        [
          'import d, { a as b } from "./m";',
          'import * as ns from "./n";',
          "export { d, b, ns };",
        ].join("\n"),
      ),
    ).toStrictEqual({
      d: { specifier: "./m", name: "default" },
      b: { specifier: "./m", name: "a" },
      ns: { specifier: "./n", name: "*" },
    });
  });
});

describe("typescript adapter exports of odd input", () => {
  it("lists nothing for a file that exports nothing", () => {
    expect(read("side-effect.ts", "console.log(1);")).toStrictEqual({
      names: [],
      forwarded: [],
    });
  });

  it("reads JavaScript with JSX", () => {
    expect(
      read("view.js", "export const View = () => <div />;")?.names.map(
        ({ name }) => name,
      ),
    ).toStrictEqual(["View"]);
  });

  it("does not list a file with syntax errors", () => {
    expect(read("broken.ts", "export const = ;")).toBeUndefined();
  });

  it("does not list a parse that throws", () => {
    const throwing = typescriptAdapter(() => {
      throw new Error("parser crashed");
    });

    expect(throwing.exports("a.ts", "export const a = 1;")).toBeUndefined();
  });
});

/** Counts how often the AST is read; the parser builds it on first access. */
const astReads = (source: string): number => {
  let reads = 0;
  const counting = typescriptAdapter((file, text, options) => {
    const parsed = parseSync(file, text, options);
    return {
      errors: parsed.errors,
      module: parsed.module,
      get program() {
        reads += 1;
        return parsed.program;
      },
    };
  });
  counting.exports("a.ts", source);
  return reads;
};

describe("typescript adapter exports and the AST", () => {
  it("leaves the AST alone for a file without a CommonJS or export-assignment form", () => {
    expect(astReads('export * from "./a";\nexport const b = 1;')).toBe(0);
  });

  it("reads the AST of a file that mentions exports in a way the record may lack", () => {
    expect(astReads("export const a = 1;\nmodule.exports.b = 2;")).toBe(1);
  });
});

describe("typescript adapter exports it cannot list", () => {
  it.each([
    ["export =", "const api = {};\nexport = api;", "api.ts"],
    ["module.exports", "module.exports = { a: 1 };", "api.js"],
    ["exports.x", "exports.a = 1;", "api.js"],
    [
      "Object.defineProperty(exports",
      'Object.defineProperty(exports, "a", { value: 1 });',
      "api.js",
    ],
    [
      "tsc's __exportStar",
      'Object.defineProperty(exports, "__esModule", { value: true });\n__exportStar(require("./a"), exports);',
      "api.js",
    ],
    [
      "ES syntax next to CommonJS",
      "export const a = 1;\nmodule.exports.b = 2;",
      "mixed.js",
    ],
  ])("does not list a file that uses %s", (_, source, file) => {
    expect(read(file, source)).toBeUndefined();
  });

  it("lists a file that only mentions exports in text", () => {
    expect(
      read(
        "doc.ts",
        '// exports a value\nexport const note = "exports";',
      )?.names.map(({ name }) => name),
    ).toStrictEqual(["note"]);
  });
});
