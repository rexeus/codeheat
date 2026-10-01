import { parseSync } from "oxc-parser";
import { describe, expect, it } from "vitest";

import { typescriptAdapter } from "./typescript-adapter.js";

const adapter = typescriptAdapter(parseSync);
const handedOn = (file: string, source: string) =>
  adapter.imports(file, source)?.reexports;

describe("typescript adapter import = declarations", () => {
  it("hands on the module of an exported import = require()", () => {
    expect(
      handedOn("a.ts", "export import T = require('./z');\n"),
    ).toStrictEqual(["./z"]);
  });

  it("hands on the module of the namespace an exported import = names", () => {
    expect(
      handedOn(
        "a.ts",
        "import * as ns from './ns';\nexport import Run = ns.run;\n",
      ),
    ).toStrictEqual(["./ns"]);
  });

  it("follows import X = ns.Y to the namespace's module when X is exported later", () => {
    expect(
      handedOn(
        "a.ts",
        "import * as ns from './ns';\nimport R = ns.run;\nexport { R };\n",
      ),
    ).toStrictEqual(["./ns"]);
  });

  it("follows import X = require() when X is exported later", () => {
    expect(
      handedOn("a.ts", "import R = require('./z');\nexport { R };\n"),
    ).toStrictEqual(["./z"]);
  });
});

const withImport = (rest: string, file = "a.ts") =>
  handedOn(file, `import { run } from './b';\n${rest}\n`);

describe("typescript adapter names that do not reference an import", () => {
  it("ignores a plain property key and a member after the dot", () => {
    expect(withImport("export const o = { run: 1 };")).toStrictEqual([]);
    expect(withImport("export const v = other.run;")).toStrictEqual([]);
  });

  it("counts a shorthand property, a computed key, and a member of an imported name", () => {
    expect(withImport("export const o = { run };")).toStrictEqual(["./b"]);
    expect(withImport("export const o = { [run]: 1 };")).toStrictEqual(["./b"]);
    expect(
      handedOn("a.ts", "import o from './b';\nexport const v = o.run;\n"),
    ).toStrictEqual(["./b"]);
  });

  it("ignores a name that a parameter or a catch binding declares", () => {
    expect(
      withImport("export const o = { f(run: number) { return run; } };"),
    ).toStrictEqual([]);
    expect(
      withImport(
        "export const o = { f() { try {} catch (run) { return run; } } };",
      ),
    ).toStrictEqual([]);
  });

  it("ignores a JSX attribute name but counts a JSX element that is the import", () => {
    expect(
      withImport('export const el = <div run="1" />;', "a.tsx"),
    ).toStrictEqual([]);
    expect(
      handedOn("a.tsx", "import Run from './b';\nexport const el = <Run />;\n"),
    ).toStrictEqual(["./b"]);
  });
});

describe("typescript adapter functions inside exported expressions", () => {
  it("treats a name used only inside a nested function as usage", () => {
    expect(withImport("export const api = { go: () => run() };")).toStrictEqual(
      [],
    );
    expect(withImport("export const go = () => run();")).toStrictEqual([]);
  });

  it("still hands on a module that a nested function loads", () => {
    expect(
      handedOn("a.ts", "export default [{ load: () => import('./Page') }];\n"),
    ).toStrictEqual(["./Page"]);
    expect(
      handedOn("a.ts", "export const o = { load: () => require('./x') };\n"),
    ).toStrictEqual(["./x"]);
    expect(
      handedOn(
        "a.ts",
        "export const o = { w: () => new URL('./w.ts', import.meta.url) };\n",
      ),
    ).toStrictEqual(["./w.ts"]);
  });
});

describe("typescript adapter exported types", () => {
  it("hands on the module of an imported type that an exported type names", () => {
    expect(
      handedOn("a.ts", "import type { T } from './t';\nexport type U = T;\n"),
    ).toStrictEqual(["./t"]);
    expect(
      handedOn("a.ts", "export type V = import('./i').I;\n"),
    ).toStrictEqual(["./i"]);
  });

  it("does not hand on what an exported interface extends", () => {
    expect(
      handedOn(
        "a.ts",
        "import type { T } from './t';\nexport interface X extends T {}\n",
      ),
    ).toStrictEqual([]);
  });
});
