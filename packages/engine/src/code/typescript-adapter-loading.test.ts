import { parseSync } from "oxc-parser";
import { describe, expect, it } from "vitest";

import { typescriptAdapter } from "./typescript-adapter.js";

const adapter = typescriptAdapter(parseSync);
const handedOn = (file: string, source: string) =>
  adapter.imports(file, source)?.reexports;

describe("typescript adapter exported functions that load modules", () => {
  it("hands on the module that an exported arrow function loads", () => {
    expect(
      handedOn("a.ts", "export const loadPage = () => import('./page');\n"),
    ).toStrictEqual(["./page"]);
    expect(
      handedOn("a.ts", "export default () => import('./Page');\n"),
    ).toStrictEqual(["./Page"]);
  });

  it("hands on the module that an exported function declaration loads", () => {
    expect(
      handedOn(
        "a.ts",
        "export default function () { return import('./x'); }\n",
      ),
    ).toStrictEqual(["./x"]);
    expect(
      handedOn("a.ts", "export function f() { return import('./x'); }\n"),
    ).toStrictEqual(["./x"]);
    expect(
      handedOn(
        "a.ts",
        "function f() { return import('./x'); }\nexport { f };\n",
      ),
    ).toStrictEqual(["./x"]);
  });

  it("hands on the module that a CommonJS export loads", () => {
    expect(
      handedOn("a.js", "exports.load = () => require('./x');\n"),
    ).toStrictEqual(["./x"]);
    expect(
      handedOn(
        "a.js",
        "module.exports = function () { return require('./x'); };\n",
      ),
    ).toStrictEqual(["./x"]);
  });

  it("does not hand on an import that an exported function only uses", () => {
    expect(
      handedOn(
        "a.ts",
        "import { run } from './b';\nexport function g() { return run(); }\n",
      ),
    ).toStrictEqual([]);
  });
});

const withBase = (rest: string) =>
  handedOn("a.ts", `import Base from './base';\n${rest}\n`);

describe("typescript adapter class heritage", () => {
  it("hands on the base class in every form, since extends is evaluated with the definition", () => {
    expect(withBase("export const A = class extends Base {};")).toStrictEqual([
      "./base",
    ]);
    expect(
      withBase("export const O = { A: class extends Base {} };"),
    ).toStrictEqual(["./base"]);
    expect(withBase("export class C extends Base {}")).toStrictEqual([
      "./base",
    ]);
  });

  it("does not hand on what a class body only uses", () => {
    expect(withBase("export class D { m() { return Base; } }")).toStrictEqual(
      [],
    );
  });
});

describe("typescript adapter names bound to what their initializer loads", () => {
  it("binds a name to the module of a member of a required module", () => {
    expect(
      handedOn(
        "lib.js",
        "const helper = require('./helper').helper;\nmodule.exports = { helper };\n",
      ),
    ).toStrictEqual(["./helper"]);
    expect(
      handedOn(
        "lib.js",
        "const d = require('./x').default;\nmodule.exports = d;\n",
      ),
    ).toStrictEqual(["./x"]);
  });

  it("binds a name to the module that a wrapper call or an await import() loads", () => {
    expect(
      handedOn(
        "lib.js",
        "const w = interop(require('./x'));\nmodule.exports = { w };\n",
      ),
    ).toStrictEqual(["./x"]);
    expect(
      handedOn(
        "m.ts",
        "const m = await import('./m');\nexport const o = { m };\n",
      ),
    ).toStrictEqual(["./m"]);
  });

  it("follows a name through several top-level bindings", () => {
    expect(
      handedOn(
        "a.ts",
        "import { run } from './b';\nconst one = { run };\nconst two = [one];\nexport default two;\n",
      ),
    ).toStrictEqual(["./b"]);
  });
});

const withImport = (rest: string, file = "a.ts") =>
  handedOn(file, `import { run } from './b';\n${rest}\n`);

describe("typescript adapter names that declare instead of reference", () => {
  it("ignores the parameter names of function types and index signatures", () => {
    expect(withImport("export type F = (run: string) => void;")).toStrictEqual(
      [],
    );
    expect(
      withImport("export type O = { [run: string]: number };"),
    ).toStrictEqual([]);
  });

  it("still counts the types that those parameters are annotated with", () => {
    expect(
      handedOn(
        "a.ts",
        "import type { T } from './t';\nexport type F = (x: T) => void;\n",
      ),
    ).toStrictEqual(["./t"]);
  });

  it("ignores a mapped type's key and a type parameter's name", () => {
    expect(
      handedOn(
        "a.ts",
        "import type { K } from './k';\nexport type M = { [K in string]: 1 };\n",
      ),
    ).toStrictEqual([]);
    expect(
      handedOn(
        "a.ts",
        "import type { X } from './x';\nexport type U<X> = string;\n",
      ),
    ).toStrictEqual([]);
  });

  it("ignores an intrinsic JSX tag and the meta of import.meta", () => {
    expect(
      handedOn(
        "a.tsx",
        "import { a } from './a';\nexport const e = <a href=\"1\" />;\n",
      ),
    ).toStrictEqual([]);
    expect(
      handedOn(
        "a.ts",
        "import { meta } from './m';\nexport const u = import.meta;\n",
      ),
    ).toStrictEqual([]);
  });
});

describe("typescript adapter type parameters of exported type aliases", () => {
  it("hands on the types that a constraint or a default names", () => {
    expect(
      handedOn(
        "a.ts",
        "import type { T } from './t';\nexport type U<X extends T> = X;\n",
      ),
    ).toStrictEqual(["./t"]);
    expect(
      handedOn(
        "a.ts",
        "import type { T } from './t';\nexport type V<X = T> = X;\n",
      ),
    ).toStrictEqual(["./t"]);
  });
});
