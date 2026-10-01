import { parseSync } from "oxc-parser";
import { describe, expect, it } from "vitest";

import { adapterFor } from "./language-adapter.js";
import { typescriptAdapter } from "./typescript-adapter.js";

const adapter = typescriptAdapter(parseSync);
const read = (file: string, source: string) => adapter.imports(file, source);

describe("typescript adapter ES module syntax", () => {
  it("lists static imports, type-only ones included", () => {
    const found = read(
      "main.ts",
      [
        'import type { A } from "./a";',
        'import { type B, C } from "./b";',
        'import d from "./d";',
        'import "./side-effect";',
        "export const used: [A, B] = [C, d] as never;",
      ].join("\n"),
    );

    expect(found?.imports).toStrictEqual([
      "./a",
      "./b",
      "./d",
      "./side-effect",
    ]);
    expect(found?.reexports).toStrictEqual([]);
  });

  it("lists every form of re-export as a re-export, not as an import", () => {
    const found = read(
      "barrel.ts",
      [
        'export * from "./c";',
        'export * as ns from "./d";',
        'export { e as f } from "./e";',
        'export type { Q } from "./q";',
        "export const own = 1;",
      ].join("\n"),
    );

    expect(found?.reexports).toStrictEqual(["./c", "./d", "./e", "./q"]);
    expect(found?.imports).toStrictEqual([]);
  });

  it("lists dynamic imports with a plain string, and skips computed ones", () => {
    const found = read(
      "lazy.ts",
      [
        'const a = () => import("./lazy");',
        "const b = () => import(`./template`);",
        "const c = (name: string) => import(`./dir/${name}`);",
        "const d = (name: string) => import(name);",
      ].join("\n"),
    );

    expect(found?.imports).toStrictEqual(["./lazy", "./template"]);
  });
});

describe("typescript adapter CommonJS and JSX", () => {
  it("lists require() calls in JavaScript, nested anywhere", () => {
    const found = read(
      "cjs.js",
      [
        'const first = require("./first");',
        'const { other } = require("./other");',
        'function load() { return { late: () => require("./late") }; }',
        "const dynamicName = require(name);",
        'module.exports = { first, other, load, local: require("node:path") };',
      ].join("\n"),
    );

    expect(found?.imports.toSorted()).toStrictEqual([
      "./first",
      "./late",
      "./other",
      "node:path",
    ]);
  });

  it("lists import = require() in TypeScript", () => {
    const found = read(
      "legacy.ts",
      'import foo = require("./foo");\nexport = foo;\n',
    );

    expect(found?.imports).toStrictEqual(["./foo"]);
  });

  it("reads JSX and an import() inside a JSX attribute in a tsx file", () => {
    const found = read(
      "view.tsx",
      [
        'import React from "react";',
        'import { Button } from "./button";',
        "export const identity = <T,>(x: T): T => x;",
        "export const View = () => (",
        '  <Button onClick={() => import("./modal")}>x</Button>',
        ");",
      ].join("\n"),
    );

    expect(found?.imports).toStrictEqual(["react", "./button", "./modal"]);
  });
});

describe("typescript adapter unknown results", () => {
  it("leaves a file without imports with an empty, known result", () => {
    expect(read("plain.mjs", "export const x = 1;\n")).toStrictEqual({
      imports: [],
      reexports: [],
      computed: false,
    });
  });

  it("treats a file with a syntax error as unknown, not as importing nothing", () => {
    const source = 'import { ok } from "./ok";\nexport const = ;\n';

    expect(read("broken.ts", source)).toBeUndefined();
  });

  it("treats a file the parser throws on as unknown", () => {
    const throwing = typescriptAdapter(() => {
      throw new Error("the native binding failed");
    });

    expect(throwing.imports("a.ts", "export {};")).toBeUndefined();
  });
});

describe("typescript adapter modules named by an expression", () => {
  it("marks a file that loads a module by an expression as computed", () => {
    const sources = [
      "export const load = (name: string) => import(name);",
      "export const load = (name: string) => import(`./dir/${name}`);",
      "const load = (name) => require(name);\nmodule.exports = load;",
      "const load = (name) => require(`./dir/${name}`);\nmodule.exports = load;",
    ];

    const computed = sources.map(
      (source, index) => read(index < 2 ? "a.ts" : "a.js", source)?.computed,
    );

    expect(computed).toStrictEqual([true, true, true, true]);
  });

  it("does not mark plain strings and templates without holes as computed", () => {
    const found = read(
      "a.js",
      'const a = require("./a");\nconst b = require(`./b`);\nconst c = () => import(`./c`);\nmodule.exports = [a, b, c];',
    );

    expect(found?.computed).toBe(false);
    expect(found?.imports.toSorted()).toStrictEqual(["./a", "./b", "./c"]);
  });
});

describe("typescript adapter TypeScript import types", () => {
  it('lists the module of import("x").T and typeof import("x") in a type', () => {
    const found = read(
      "types.ts",
      [
        'export type A = import("./x").T;',
        'export type B = typeof import("./y");',
        "export type C = Array<import('./z').U>;",
      ].join("\n"),
    );

    expect(found?.imports.toSorted()).toStrictEqual(["./x", "./y", "./z"]);
  });

  it("is not looked for in JavaScript, where import() is never a type", () => {
    const found = read("a.js", 'const lazy = () => import("./lazy");');

    expect(found?.imports).toStrictEqual(["./lazy"]);
  });
});

describe("typescript adapter JSX in JavaScript files", () => {
  it("reads JSX in a .js file by retrying the parse as JSX", () => {
    const found = read(
      "view.js",
      'import { Button } from "./button";\nexport const View = () => <Button>x</Button>;\n',
    );

    expect(found?.imports).toStrictEqual(["./button"]);
  });

  it("still treats a .js file with a real syntax error as unknown", () => {
    expect(read("broken.js", "export const = ;")).toBeUndefined();
  });

  it("does not retry TypeScript, where JSX has its own extension", () => {
    expect(
      read("view.ts", "export const View = () => <b>x</b>;"),
    ).toBeUndefined();
  });
});

describe("typescript adapter canReexport", () => {
  it("is false for a source that has nothing to forward", () => {
    expect(adapter.canReexport("export const y = 1;\n")).toBe(false);
    expect(
      adapter.canReexport('import { x } from "./x";\nconsole.log(x);'),
    ).toBe(false);
  });

  it("is true whenever the source exports and mentions a module", () => {
    expect(adapter.canReexport('export * from "./a";')).toBe(true);
    expect(adapter.canReexport('import { x } from "./x";\nexport { x };')).toBe(
      true,
    );
    expect(adapter.canReexport('module.exports = { ...require("./a") };')).toBe(
      true,
    );
  });
});

describe("adapterFor", () => {
  it("selects by extension, ignoring case, and finds none for other languages", () => {
    const adapters = [adapter];

    expect(adapterFor(adapters, "src/Legacy.CJS")).toBe(adapter);
    expect(adapterFor(adapters, "src/view.tsx")).toBe(adapter);
    expect(adapterFor(adapters, "tool/main.py")).toBeUndefined();
    expect(adapterFor(adapters, "Makefile")).toBeUndefined();
  });
});
